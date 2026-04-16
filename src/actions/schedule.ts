"use server";

import { revalidatePath } from "next/cache";
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
};

// TVmaze rate limit: 20 req/10s — cap concurrent show fetches at 3
async function withConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.all(items.slice(i, i + concurrency).map(fn));
    }
}

const MDL_MONTH: Record<string, string> = {
    January: "01", February: "02", March: "03", April: "04",
    May: "05", June: "06", July: "07", August: "08",
    September: "09", October: "10", November: "11", December: "12",
};

function parseMdlAirDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    // "May 13, 2025" → "2025-05-13"
    const m = raw.match(/^(\w+)\s+(\d+),\s+(\d{4})$/);
    if (!m) return null;
    const month = MDL_MONTH[m[1]];
    if (!month) return null;
    return `${m[3]}-${month}-${m[2].padStart(2, "0")}`;
}

async function fetchAndCacheEpisodes(
    mediaId: string,
    externalId: string,
    title: string | null,
): Promise<{ airDate: string; episodeNumber: number; seasonNumber: number; episodeName?: string }[]> {
    let tvmazeEpisodes: Awaited<ReturnType<typeof tvmaze.getAllEpisodes>> = [];
    try {
        const externalIds = await tmdb.getExternalIds("tv", externalId);
        tvmazeEpisodes = await tvmaze.getAllEpisodes({
            imdbId: externalIds?.imdb_id,
            tvdbId: externalIds?.tvdb_id,
            showName: title,
        });
    } catch {
        // TMDB/TVmaze lookup failed — fall through to MDL fallback
    }

    if (tvmazeEpisodes.length > 0) {
        await prisma.cachedEpisode.createMany({
            data: tvmazeEpisodes.map((ep) => ({
                mediaId,
                airDate: ep.airDate,
                episodeNumber: ep.episodeNumber,
                seasonNumber: ep.seasonNumber,
                episodeName: ep.name || null,
            })),
            skipDuplicates: true,
        });
        return tvmazeEpisodes.map((ep) => ({
            airDate: ep.airDate,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
            episodeName: ep.name,
        }));
    }

    // TVmaze returned nothing — try MDL episodes as fallback
    const mdlRow = await prisma.cachedMdlData.findUnique({ where: { tmdbExternalId: externalId } });
    if (!mdlRow?.mdlSlug) return [];

    const mdlResult = await kuryanaGetEpisodesList(mdlRow.mdlSlug);
    if (!mdlResult?.data?.episodes?.length) return [];

    const episodes: { airDate: string; episodeNumber: number; seasonNumber: number; episodeName?: string }[] = [];
    for (const ep of mdlResult.data.episodes) {
        const airDate = parseMdlAirDate(ep.air_date);
        if (!airDate) continue;
        // Extract episode number from link: ".../episode/3" → 3
        const epNumMatch = ep.link.match(/\/episode\/(\d+)/);
        if (!epNumMatch) continue;
        episodes.push({
            airDate,
            episodeNumber: parseInt(epNumMatch[1]),
            seasonNumber: 1,
            episodeName: ep.title,
        });
    }

    if (episodes.length > 0) {
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
    }

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

    const results: ScheduleEntry[] = [];
    const cacheMisses: typeof uniqueItems = [];

    for (const item of uniqueItems) {
        const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
        const cached = cacheByMediaId.get(mediaId);

        if (cached && cached.length > 0) {
            for (const ep of cached) {
                results.push({
                    title: item.title || "Unknown",
                    poster: item.poster,
                    episodeNumber: ep.episodeNumber,
                    seasonNumber: ep.seasonNumber,
                    episodeName: ep.episodeName ?? undefined,
                    airDate: ep.airDate,
                    mediaId,
                    originCountry: item.originCountry || "",
                });
            }
        } else {
            cacheMisses.push(item);
        }
    }

    // Fetch from TVmaze only for cache misses (rare after initial population)
    if (cacheMisses.length > 0) {
        await withConcurrency(cacheMisses, 3, async (item) => {
            try {
                const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
                const episodes = await fetchAndCacheEpisodes(mediaId, item.externalId, item.title);
                for (const ep of episodes) {
                    results.push({
                        title: item.title || "Unknown",
                        poster: item.poster,
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: ep.seasonNumber,
                        episodeName: ep.episodeName,
                        airDate: ep.airDate,
                        mediaId,
                        originCountry: item.originCountry || "",
                    });
                }
            } catch (error) {
                console.error(`Failed to get schedule for ${item.title}:`, error);
            }
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

export async function refreshScheduleCache(): Promise<void> {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch"] },
            mediaType: "TV",
            source: "TMDB",
        },
        select: {
            externalId: true,
            source: true,
            title: true,
        },
    });

    if (items.length === 0) return;

    const uniqueItems = [...new Map(items.map((i) => [`${i.source.toLowerCase()}-${i.externalId}`, i])).values()];

    // Clear existing cache for these shows
    const mediaIds = uniqueItems.map((i) => `${i.source.toLowerCase()}-${i.externalId}`);
    await prisma.cachedEpisode.deleteMany({ where: { mediaId: { in: mediaIds } } });

    // Re-fetch and re-cache
    await withConcurrency(uniqueItems, 3, async (item) => {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            await fetchAndCacheEpisodes(mediaId, item.externalId, item.title);
        } catch (error) {
            console.error(`Failed to refresh cache for ${item.title}:`, error);
        }
    });

    revalidatePath("/calendar");
}
