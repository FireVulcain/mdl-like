"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { tvmaze } from "@/lib/tvmaze";
import { tmdb } from "@/lib/tmdb";
import { kuryanaGetEpisodesList } from "@/lib/kuryana";
import { getCurrentUserId } from "@/lib/session";

export type ScheduleEntry = {
    title: string;
    poster: string | null;
    episodeNumber: number;
    seasonNumber: number;
    episodeName?: string;
    airDate: string; // YYYY-MM-DD
    mediaId: string;
    originCountry: string;
    status: string;
};

// TVmaze rate limit: 20 req/10s — cap concurrent show fetches at 3
async function withConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.all(items.slice(i, i + concurrency).map(fn));
    }
}

// Keyed by the first three letters, lowercased: the episode list writes
// "Aug 02, 2026" while other MDL pages spell the month out. Matching on the
// full name alone silently rejected every date the list returned, which left
// the fallback below unable to ever produce an episode.
const MDL_MONTH: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12",
};

function parseMdlAirDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    // "May 13, 2025" / "Aug 02, 2026" → "2025-05-13" / "2026-08-02"
    const m = raw.match(/^(\w+)\s+(\d+),\s+(\d{4})$/);
    if (!m) return null;
    const month = MDL_MONTH[m[1].slice(0, 3).toLowerCase()];
    if (!month) return null;
    return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

// How long "no source knows this show's episodes" is believed. It has to expire:
// a drama that has aired but isn't scheduled anywhere yet gets its dates days
// later, and a permanent sentinel meant the calendar never looked again — the
// show stayed empty for good, with no way back short of the manual refresh.
// Same 6h as the next-episode cache, for the same reason.
const NO_EPISODES_TTL_MS = 6 * 60 * 60 * 1000;

// A show whose last known episode aired within this window is treated as
// possibly still running, and its schedule is re-read when it looks exhausted.
// Past it, the show is over as far as the calendar is concerned — without this
// every finished drama in the watchlist would be re-scraped forever.
const STILL_RUNNING_DAYS = 21;

// Ceiling on background top-ups per calendar load, so a watchlist full of
// airing shows can't turn one page view into a scrape storm.
const BACKGROUND_REFRESH_PER_LOAD = 6;

// Shows never looked up before are the one case still fetched during the
// render — a drama tracked a minute ago has no cached date to show otherwise.
// Kept small: past this the rest goes to the background queue and lands on the
// next load, which is the difference between a page that waits and one that
// hangs.
const NEW_SHOW_LOOKUP_PER_LOAD = 4;

// Negative cache: when no source knows a show's episodes, write a sentinel row
// so the show counts as cached — otherwise every calendar load re-scrapes it
// (episodeNumber 0 rows are filtered out when reading). Upserted rather than
// inserted so a fruitless retry pushes the next one out by another TTL instead
// of leaving an expired sentinel that re-scrapes on every single load.
async function markNoEpisodes(mediaId: string): Promise<never[]> {
    await prisma.cachedEpisode
        .upsert({
            where: { mediaId_seasonNumber_episodeNumber: { mediaId, seasonNumber: 0, episodeNumber: 0 } },
            create: { mediaId, airDate: "1900-01-01", episodeNumber: 0, seasonNumber: 0 },
            update: { updatedAt: new Date() },
        })
        .catch(() => {});
    return [];
}

type EpisodeRow = { airDate: string; episodeNumber: number; seasonNumber: number; episodeName?: string };

// Neither source leaves the title blank when a show has no episode titles: MDL
// fills it with "<Show> Episode 23", TVmaze with a bare "Episode 23". Printed
// next to "S01E23" under the show's name, that says the same thing three times.
// Treated as absent, which is what it means.
function realEpisodeName(name: string | null | undefined): string | undefined {
    const trimmed = name?.trim();
    if (!trimmed) return undefined;
    return /episode\s*\d+$/i.test(trimmed) ? undefined : trimmed;
}

// MDL's own episode list for a show, empty when we have no slug or it has none.
// seasonNumber is left to the caller: an MDL entry IS one season, and it always
// numbers its episodes from 1, so the number alone doesn't say which.
async function fetchMdlEpisodes(externalId: string): Promise<Omit<EpisodeRow, "seasonNumber">[]> {
    const mdlRow = await prisma.cachedMdlData.findUnique({ where: { tmdbExternalId: externalId } });
    if (!mdlRow?.mdlSlug || mdlRow.mdlDisabled) return [];

    const mdlResult = await kuryanaGetEpisodesList(mdlRow.mdlSlug).catch(() => null);
    if (!mdlResult?.data?.episodes?.length) return [];

    const episodes: Omit<EpisodeRow, "seasonNumber">[] = [];
    for (const ep of mdlResult.data.episodes) {
        const airDate = parseMdlAirDate(ep.air_date);
        if (!airDate) continue;
        // Extract episode number from link: ".../episode/3" → 3
        const epNumMatch = ep.link.match(/\/episode\/(\d+)/);
        if (!epNumMatch) continue;
        episodes.push({ airDate, episodeNumber: parseInt(epNumMatch[1]), episodeName: realEpisodeName(ep.title) });
    }
    return episodes;
}

async function fetchAndCacheEpisodes(
    mediaId: string,
    externalId: string,
    title: string | null,
): Promise<EpisodeRow[]> {
    let tvmazeEpisodes: Awaited<ReturnType<typeof tvmaze.getAllEpisodes>> = [];
    try {
        const externalIds = await tmdb.getExternalIds("tv", externalId);
        tvmazeEpisodes = await tvmaze.getAllEpisodes({
            imdbId: externalIds?.imdb_id,
            tvdbId: externalIds?.tvdb_id,
            showName: title,
        });
    } catch {
        // TMDB/TVmaze lookup failed — MDL alone below
    }

    const episodes: EpisodeRow[] = tvmazeEpisodes.map((ep) => ({
        airDate: ep.airDate,
        episodeNumber: ep.episodeNumber,
        seasonNumber: ep.seasonNumber,
        episodeName: realEpisodeName(ep.name),
    }));

    // TVmaze is the better source where it knows: real season numbers, episode
    // titles. But on Asian dramas it lags — it stops at whatever has already
    // aired, days behind MDL, which publishes the whole run in advance. Taking
    // it alone froze a running show at the episode count of the day it was first
    // cached, and taking MDL alone would lose the season numbers the calendar
    // prints. So TVmaze holds what it knows and MDL adds the tail.
    const tvSeasons = new Set(episodes.map((ep) => ep.seasonNumber));
    const canAppendMdl = tvSeasons.size <= 1; // see fetchMdlEpisodes: MDL numbers per season
    if (canAppendMdl) {
        const season = tvSeasons.values().next().value ?? 1;
        const highest = episodes.reduce((max, ep) => Math.max(max, ep.episodeNumber), 0);
        const mdlEpisodes = await fetchMdlEpisodes(externalId);
        for (const ep of mdlEpisodes) {
            if (ep.episodeNumber <= highest) continue; // TVmaze already has it, and knows it better
            episodes.push({ ...ep, seasonNumber: season });
        }
    }

    if (episodes.length === 0) return markNoEpisodes(mediaId);

    await prisma.cachedEpisode.createMany({
        data: episodes.map((ep) => ({
            mediaId,
            airDate: ep.airDate,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
            episodeName: ep.episodeName || null,
        })),
        skipDuplicates: true,
    });

    // skipDuplicates writes nothing for a show we already hold every episode of,
    // so updatedAt kept the date of the very first fetch. The staleness test
    // reads that column: a re-read that confirmed the list was complete looked
    // exactly like one that had never happened, and the show came back stale on
    // every load thereafter, forever. Stamping it is what records "checked".
    await prisma.cachedEpisode.updateMany({ where: { mediaId }, data: { updatedAt: new Date() } });

    return episodes;
}

export async function getScheduleEntries(): Promise<ScheduleEntry[]> {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch", "Completed"] },
            mediaType: "TV",
            source: "TMDB",
        },
        select: {
            externalId: true,
            source: true,
            title: true,
            poster: true,
            originCountry: true,
            status: true,
        },
    });

    if (items.length === 0) return [];

    // Deduplicate by mediaId — same show can appear multiple times (different tracked seasons)
    const uniqueItems = [...new Map(items.map((i) => [`${i.source.toLowerCase()}-${i.externalId}`, i])).values()];

    const mediaIds = uniqueItems.map((i) => `${i.source.toLowerCase()}-${i.externalId}`);

    // Single bulk query for all cached episodes — eliminates N+1 DB round trips
    const allCached = await prisma.cachedEpisode.findMany({
        where: { mediaId: { in: mediaIds } },
    });

    const cacheByMediaId = new Map<string, typeof allCached>();
    for (const ep of allCached) {
        if (!cacheByMediaId.has(ep.mediaId)) cacheByMediaId.set(ep.mediaId, []);
        cacheByMediaId.get(ep.mediaId)!.push(ep);
    }

    const today = new Date().toISOString().split("T")[0];
    const recentCutoff = new Date(Date.now() - STILL_RUNNING_DAYS * 86_400_000).toISOString().split("T")[0];

    const results: ScheduleEntry[] = [];
    // A show we have never looked up: worth a short wait, since it is the only
    // way a newly tracked drama appears at all.
    const neverLooked: typeof uniqueItems = [];
    // A show we looked up and found nothing for, whose sentinel has expired.
    // Never worth waiting on: it came back empty once and almost always will
    // again, and these expire in a batch — see the comment on the retry queue.
    const sentinelRetries: typeof uniqueItems = [];
    const staleShows: typeof uniqueItems = [];

    for (const item of uniqueItems) {
        const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
        const cached = cacheByMediaId.get(mediaId) ?? [];
        const known = cached.filter((ep) => ep.episodeNumber > 0); // drop the sentinel

        if (known.length > 0) {
            for (const ep of known) {
                results.push({
                    title: item.title || "Unknown",
                    poster: item.poster,
                    episodeNumber: ep.episodeNumber,
                    seasonNumber: ep.seasonNumber,
                    // Also filtered on the way out, not just on the way in: rows
                    // cached before this existed still carry the padded title
                    episodeName: realEpisodeName(ep.episodeName),
                    airDate: ep.airDate,
                    mediaId,
                    originCountry: item.originCountry || "",
                    status: item.status,
                });
            }

            // A list captured mid-run stops at the episode that existed that day,
            // and nothing ever went back for the rest. So: everything we hold has
            // aired, yet the last one aired recently enough that the show is
            // probably still going — go and look again. A drama that ended years
            // ago fails the second test and is never re-fetched.
            const lastAired = known.reduce((max, ep) => (ep.airDate > max ? ep.airDate : max), "");
            const lastChecked = Math.max(...known.map((ep) => ep.updatedAt.getTime()));
            const hasFuture = known.some((ep) => ep.airDate >= today);
            if (!hasFuture && lastAired >= recentCutoff && Date.now() - lastChecked > NO_EPISODES_TTL_MS) {
                staleShows.push(item);
            }
            continue;
        }

        // Nothing but a sentinel, or nothing at all. Retry once it has expired —
        // an empty cache is a statement about the sources at one moment, not
        // about the show.
        if (cached.length === 0) {
            neverLooked.push(item);
            continue;
        }
        const sentinelAge = Date.now() - Math.max(...cached.map((ep) => ep.updatedAt.getTime()));
        if (sentinelAge > NO_EPISODES_TTL_MS) sentinelRetries.push(item);
    }

    // Only shows we have never looked up are waited on, and only a few of them:
    // a newly tracked drama has no other way of appearing. Everything else is
    // queued below.
    const lookupNow = neverLooked.slice(0, NEW_SHOW_LOOKUP_PER_LOAD);
    if (lookupNow.length > 0) {
        await withConcurrency(lookupNow, 3, async (item) => {
            try {
                const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
                const episodes = await fetchAndCacheEpisodes(mediaId, item.externalId, item.title);
                for (const ep of episodes) {
                    results.push({
                        title: item.title || "Unknown",
                        poster: item.poster,
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: ep.seasonNumber,
                        episodeName: realEpisodeName(ep.episodeName),
                        airDate: ep.airDate,
                        mediaId,
                        originCountry: item.originCountry || "",
                        status: item.status,
                    });
                }
            } catch (error) {
                console.error(`Failed to get schedule for ${item.title}:`, error);
            }
        });
    }

    // Top-ups run AFTER the response: the calendar already has every date we
    // know, and the missing tail is worth a page load's wait, not a scrape the
    // user sits through. The rows land in the cache and show up on the next load.
    //
    // Sentinel retries belong here rather than in the render, and are last in
    // the queue. They are written in one batch — every show no source could
    // resolve, stamped in the same instant by whichever load first looked — so
    // they expire in that same batch six hours later, and the next visitor used
    // to pay for all of them at once. Each is also the most expensive kind of
    // lookup there is, since a show nothing can find is one where every source
    // is tried and every source misses. That is the whole of the "instant for
    // six hours, then unusable" cycle.
    const backlog = [
        ...neverLooked.slice(NEW_SHOW_LOOKUP_PER_LOAD),
        ...staleShows,
        ...sentinelRetries,
    ].slice(0, BACKGROUND_REFRESH_PER_LOAD);

    if (backlog.length > 0) {
        after(async () => {
            for (const item of backlog) {
                try {
                    await fetchAndCacheEpisodes(
                        `${item.source.toLowerCase()}-${item.externalId}`,
                        item.externalId,
                        item.title,
                    );
                } catch {
                    // best effort — a later visit retries
                }
            }
            revalidatePath("/calendar");
        });
    }

    return results.sort((a, b) => a.airDate.localeCompare(b.airDate));
}

export async function refreshSingleShow(mediaId: string): Promise<void> {
    await getCurrentUserId(); // ensure authenticated

    await prisma.cachedEpisode.deleteMany({ where: { mediaId } });

    // mediaId format: "tmdb-{externalId}"
    const [source, externalId] = [mediaId.split("-")[0], mediaId.split("-").slice(1).join("-")];
    const item = await prisma.userMedia.findFirst({
        where: {
            externalId,
            source: source.toUpperCase(),
            mediaType: "TV",
        },
        select: { title: true },
    });

    if (!item) return;

    await fetchAndCacheEpisodes(mediaId, externalId, item.title);
    revalidatePath("/calendar");
}

/**
 * The shows a full calendar refresh would touch.
 *
 * Split out so the client knows the total before starting, which is the whole
 * difference between a spinner and "12 of 34". The refresh itself then runs in
 * chunks the caller drives, the same shape the watchlist bulk refreshes use —
 * one long server action could not report anything on its way through, and on a
 * large list it also risks the serverless time limit.
 */
export async function getScheduleRefreshTargets(): Promise<{ mediaId: string; title: string | null }[]> {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch"] },
            mediaType: "TV",
            source: "TMDB",
        },
        select: { externalId: true, source: true, title: true },
    });

    const unique = new Map(
        items.map((i) => [`${i.source.toLowerCase()}-${i.externalId}`, i.title] as const),
    );
    return [...unique].map(([mediaId, title]) => ({ mediaId, title }));
}

/** One chunk of the refresh above. Returns how many shows it actually re-cached. */
export async function refreshScheduleChunk(mediaIds: string[]): Promise<{ count: number }> {
    const userId = await getCurrentUserId();
    if (mediaIds.length === 0) return { count: 0 };

    // Re-read the titles rather than trusting the client with them: the caller
    // only ever hands back ids this user was given.
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            mediaType: "TV",
            source: "TMDB",
            externalId: { in: mediaIds.map((id) => id.split("-").slice(1).join("-")) },
        },
        select: { externalId: true, source: true, title: true },
    });

    const byMediaId = new Map(items.map((i) => [`${i.source.toLowerCase()}-${i.externalId}`, i]));
    const targets = mediaIds.map((id) => byMediaId.get(id)).filter((i) => i !== undefined);
    if (targets.length === 0) return { count: 0 };

    await prisma.cachedEpisode.deleteMany({
        where: { mediaId: { in: targets.map((i) => `${i.source.toLowerCase()}-${i.externalId}`) } },
    });

    let count = 0;
    await withConcurrency(targets, 3, async (item) => {
        try {
            await fetchAndCacheEpisodes(`${item.source.toLowerCase()}-${item.externalId}`, item.externalId, item.title);
            count++;
        } catch (error) {
            console.error(`Failed to refresh cache for ${item.title}:`, error);
        }
    });

    revalidatePath("/calendar");
    return { count };
}
