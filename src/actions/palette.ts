"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { ActivityAction } from "@/types/activity";
import { updateUserMedia } from "@/actions/media";
import { getScheduleEntries } from "@/actions/schedule";
import { getDashboardStats } from "@/actions/stats";
import { mdlPersonSlug, personHref } from "@/lib/person-links";
import { mediaService } from "@/services/media.service";
import { getNativeTitles, prefillNativeTitles } from "@/lib/native-titles";
import { getDisplayPreferences } from "@/actions/preferences";

export type PaletteItem = {
    id: string;
    /** Seasons share it, which is what lets a season find the show's cast. */
    externalId: string;
    /** What to show — english or native, per the user's display preference. */
    title: string;
    /**
     * The other spelling, when one is known. Searched but never displayed, so
     * "별들에게" finds a row labelled "Ask the Stars" and vice versa — the palette
     * should not care which half of a title someone remembers.
     */
    altTitle: string | null;
    /**
     * Main-cast character names for this show. Searched, never drawn as the
     * label — a row found through "Hong Cha Young" is still the row for
     * Vincenzo, and says underneath which character it matched on.
     */
    characters: string[];
    poster: string | null;
    href: string;
    season: number;
    /** Last episode actually watched; null means index-only, never watched. */
    watchedAt: string | null;
    status: string;
    progress: number;
    totalEp: number | null;
    year: number | null;
};

/**
 * The palette's local index.
 *
 * Deliberately not `getWatchlist()`: that one joins cached MDL rows and season
 * links to build the full table, which is far more than a list of names needs.
 * This is one indexed query over columns the palette actually shows, fetched
 * once on first open and then held in memory for the rest of the session.
 */
export async function getPaletteWatchlist(): Promise<PaletteItem[]> {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: { userId },
        select: {
            id: true,
            title: true,
            poster: true,
            source: true,
            externalId: true,
            season: true,
            status: true,
            progress: true,
            totalEp: true,
            year: true,
        },
    });

    // Stored titles are always english — they feed TVmaze and MDL matching — so
    // the native one is resolved separately, exactly as the watchlist does it.
    const externalIds = [...new Set(items.map((i) => i.externalId))];
    const [showLinks, seasonLinks, { titleLanguage }] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: externalIds } },
            select: { tmdbExternalId: true, mdlSlug: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId: { in: externalIds } },
            select: { tmdbExternalId: true, season: true, mdlSlug: true },
        }),
        // Alongside, not after: the preference does not depend on the slugs, and
        // the palette's first open is the one moment that has to feel instant.
        getDisplayPreferences(),
    ]);

    const slugByShow = new Map(showLinks.map((r) => [r.tmdbExternalId, r.mdlSlug]));
    const slugBySeason = new Map(seasonLinks.map((r) => [`${r.tmdbExternalId}-${r.season}`, r.mdlSlug]));
    const slugFor = (externalId: string, season: number) =>
        slugBySeason.get(`${externalId}-${season}`) ?? slugByShow.get(externalId) ?? null;

    const slugs = items.map((i) => slugFor(i.externalId, i.season)).filter((s): s is string => s !== null);
    const nativeBySlug = await getNativeTitles(slugs);

    // Every other caller fills this cache only when the display preference is
    // native, because that is the only time they draw the title. The palette
    // matches on it whatever is being displayed, so under an english preference
    // it was reading a cache nobody was filling — 100 slugs out of 255, frozen.
    //
    // Scheduled, not awaited: prefillNativeTitles runs inside after(), so the
    // scrapes start once this response is already on its way out. Ten per open
    // at 200ms apart covers the gap over a handful of visits without ever being
    // something the palette waits for.
    prefillNativeTitles(
        slugs.filter((slug) => !nativeBySlug.has(slug)),
        10,
    );

    const preferNative = titleLanguage === "native";

    // Not `lastWatchedAt`: updateUserMedia bumps that on any status change, so
    // dropping a show or moving it to Plan to Watch would file it under
    // "recently watched". Progress events are the only record of actually
    // watching something. Within a 30-minute session upsertProgressLog merges
    // into the existing row, so this is the start of the session rather than
    // the last click — which is the more useful of the two anyway.
    const watched = await prisma.activityLog.groupBy({
        by: ["userMediaId"],
        where: { userId, action: ActivityAction.PROGRESS, userMediaId: { not: null } },
        _max: { createdAt: true },
    });
    const watchedAt = new Map(watched.map((row) => [row.userMediaId, row._max.createdAt]));

    // Character names, straight out of the cast blob the MDL cache already
    // holds — no request, and coverage is total: every one of the 2848 stored
    // main-cast entries carries one. Main roles only, for the same reason the
    // people index stops there: those are the names anyone remembers, and the
    // support cast would multiply the index for names nobody searches by.
    //
    // Keyed on externalId, so every season of a show shares one cast, which is
    // what the cast pages do too.
    const characterRows = await prisma.$queryRaw<{ externalId: string; character: string | null }[]>`
        select c."tmdbExternalId" as "externalId",
               p.value->>'characterName' as character
        from "CachedMdlData" c
        join (select distinct "externalId" from "UserMedia" where "userId" = ${userId}) u
          on u."externalId" = c."tmdbExternalId",
        lateral jsonb_array_elements(coalesce(c."castJson"->'main', '[]'::jsonb)) p(value)
    `;

    const charactersByShow = new Map<string, string[]>();
    for (const row of characterRows) {
        const name = row.character?.trim();
        if (!name) continue;
        const list = charactersByShow.get(row.externalId) ?? [];
        if (!list.includes(name)) list.push(name);
        charactersByShow.set(row.externalId, list);
    }

    return items
        .filter((item) => item.title)
        .map((item) => ({
            id: item.id,
            externalId: item.externalId,
            ...(() => {
                const slug = slugFor(item.externalId, item.season);
                const native = (slug ? nativeBySlug.get(slug) : null) || null;
                // Resolved here rather than in the component: the preference is a
                // server concern, and the client only needs to know what to draw
                // and what else to match on.
                return preferNative && native
                    ? { title: native, altTitle: item.title! }
                    : { title: item.title!, altTitle: native };
            })(),
            characters: charactersByShow.get(item.externalId) ?? [],
            poster: item.poster,
            // Seasons are separate rows with separate pages, exactly as the
            // watchlist links them — two entries for one show are not duplicates.
            href: `/media/${item.source.toLowerCase()}-${item.externalId}${item.season > 1 ? `?season=${item.season}` : ""}`,
            season: item.season,
            watchedAt: watchedAt.get(item.id)?.toISOString() ?? null,
            status: item.status,
            progress: item.progress,
            totalEp: item.totalEp,
            year: item.year,
        }))
        // Most recently watched first, never-watched last. Sorting here rather
        // than in SQL because the timestamp comes from the second query.
        .sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""));
}

/**
 * Step the last progress change back to where it was.
 *
 * The activity log already stores `{ from, to }` on every progress event, so
 * the previous value is a fact rather than a guess — no separate undo stack.
 * Only the most recent event is reversible, and only if it still matches the
 * item's current progress; anything else means something changed since, and
 * silently rewinding it would be worse than refusing.
 */
export async function undoLastProgress(): Promise<{ ok: boolean; message: string }> {
    const userId = await getCurrentUserId();

    const log = await prisma.activityLog.findFirst({
        where: { userId, action: ActivityAction.PROGRESS, userMediaId: { not: null }, isBackfill: false },
        orderBy: { createdAt: "desc" },
    });
    if (!log?.userMediaId) return { ok: false, message: "Nothing to undo" };

    const payload = log.payload as { from?: unknown; to?: unknown } | null;
    const from = typeof payload?.from === "number" ? payload.from : null;
    const to = typeof payload?.to === "number" ? payload.to : null;
    if (from === null || to === null) return { ok: false, message: "Nothing to undo" };

    const item = await prisma.userMedia.findFirst({ where: { id: log.userMediaId, userId } });
    if (!item) return { ok: false, message: "Nothing to undo" };
    if (item.progress !== to) {
        return { ok: false, message: `${item.title ?? "That title"} has changed since — undo skipped` };
    }

    await updateUserMedia(item.id, { progress: from });
    return { ok: true, message: `${item.title ?? "Progress"} back to episode ${from}` };
}


export type PaletteAiringEntry = { key: string; title: string; poster: string | null; href: string; detail: string };

/**
 * Today's episodes, for the palette's airing menu.
 *
 * The date key comes from the client because "today" is a question about the
 * user's clock, not the server's — a Vercel box in UTC and a viewer in KST
 * disagree for nine hours a day.
 */
export async function getAiringToday(dateKey: string): Promise<PaletteAiringEntry[]> {
    const entries = await getScheduleEntries();
    return entries
        .filter((entry) => entry.airDate === dateKey)
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((entry) => ({
            key: `${entry.mediaId}-${entry.seasonNumber}-${entry.episodeNumber}`,
            title: entry.title,
            poster: entry.poster,
            href: `/media/${entry.mediaId}?season=${entry.seasonNumber}`,
            detail: entry.episodeName ? `Episode ${entry.episodeNumber} · ${entry.episodeName}` : `Episode ${entry.episodeNumber}`,
        }));
}

export type PaletteStat = { key: string; label: string };

/**
 * The handful of numbers worth answering without leaving the page.
 *
 * Built on getDashboardStats rather than a leaner query of its own, so the
 * palette can never quote a figure the /stats page disagrees with.
 */
export async function getPaletteStats(): Promise<PaletteStat[]> {
    const stats = await getDashboardStats();

    const rated = stats.ratingDistribution.filter((r) => r.rating > 0);
    const ratedCount = rated.reduce((acc, r) => acc + r.count, 0);
    const average = ratedCount > 0 ? rated.reduce((acc, r) => acc + r.rating * r.count, 0) / ratedCount : null;

    // Floor, like the stats dashboard and the watchlist header — two surfaces
    // quoting different totals for the same thing is worse than either being
    // slightly low. Locale pinned for the same reason: the server's default
    // would group digits differently from every other number in the app.
    const hours = Math.floor(stats.watchTimeMinutes / 60);
    const days = (stats.watchTimeMinutes / (60 * 24)).toFixed(1);
    const n = (value: number) => value.toLocaleString("en-US");

    return [
        { key: "titles", label: `${stats.totalMovies + stats.totalTV} titles watched — ${stats.totalTV} series, ${stats.totalMovies} movies` },
        { key: "episodes", label: `${n(stats.totalEpisodes)} episodes watched` },
        { key: "time", label: `${n(hours)} hours watched — about ${days} days of your life` },
        ...(average !== null ? [{ key: "average", label: `Average rating ${average.toFixed(1)} across ${ratedCount} rated titles` }] : []),
        ...(stats.topGenres[0] ? [{ key: "genre", label: `Most watched genre: ${stats.topGenres[0].name}` }] : []),
        { key: "completion", label: `${Math.round(stats.completionRate)}% completion of everything started` },
    ];
}

export type PalettePersonShow = {
    externalId: string;
    title: string;
    href: string;
    /** Position in the show's main cast, so a cast list can be billed in order. */
    order: number;
};
export type PalettePerson = { slug: string; name: string; image: string | null; shows: PalettePersonShow[] };

/**
 * The actors in the shows you watch, for the palette's local index.
 *
 * Main cast only. Adding support roles takes this from 488 people to 2,845 —
 * every twelfth-billed part across the whole watchlist — which is six times the
 * payload for names nobody would recognise as being in anything. Main cast is
 * ~29KB, small enough to sit beside the title index and stay instant.
 *
 * The join already knows which of your shows each person is in, so the action
 * level ("what have I watched with X?") costs nothing extra.
 */
export async function getPalettePeople(): Promise<PalettePerson[]> {
    const userId = await getCurrentUserId();

    const [rows, media] = await Promise.all([
        prisma.$queryRaw<{ slug: string | null; name: string | null; image: string | null; externalId: string; order: number }[]>`
            select p.value->>'slug' as slug,
                   p.value->>'name' as name,
                   p.value->>'profileImage' as image,
                   c."tmdbExternalId" as "externalId",
                   p.ordinality::int as "order"
            from "CachedMdlData" c
            join (select distinct "externalId" from "UserMedia" where "userId" = ${userId}) u
              on u."externalId" = c."tmdbExternalId",
            lateral jsonb_array_elements(coalesce(c."castJson"->'main', '[]'::jsonb)) with ordinality p(value, ordinality)
        `,
        prisma.userMedia.findMany({
            where: { userId },
            select: { externalId: true, source: true, season: true, title: true },
            orderBy: { season: "asc" },
        }),
    ]);

    // First season wins: one entry per show, linked the way the watchlist links it.
    const showByExternalId = new Map<string, Omit<PalettePersonShow, "order">>();
    for (const item of media) {
        if (!item.title || showByExternalId.has(item.externalId)) continue;
        showByExternalId.set(item.externalId, {
            externalId: item.externalId,
            title: item.title,
            href: `/media/${item.source.toLowerCase()}-${item.externalId}${item.season > 1 ? `?season=${item.season}` : ""}`,
        });
    }

    const bySlug = new Map<string, PalettePerson>();
    for (const row of rows) {
        const slug = mdlPersonSlug(row.slug);
        if (!slug || !row.name) continue;

        const person = bySlug.get(slug) ?? { slug, name: row.name, image: row.image, shows: [] };
        const show = showByExternalId.get(row.externalId);
        if (show && !person.shows.some((s) => s.externalId === show.externalId)) {
            person.shows.push({ ...show, order: row.order });
        }
        bySlug.set(slug, person);
    }

    // Appearances are the ranking the join hands us for free: someone in five of
    // your shows belongs above a one-off, whatever the fuzzy score says.
    return [...bySlug.values()].sort((a, b) => b.shows.length - a.shows.length || a.name.localeCompare(b.name));
}

export type PaletteRemoteItem = {
    key: string;
    kind: "media" | "person";
    title: string;
    detail: string;
    image: string | null;
    href: string;
};

/** Below this the query is too vague to spend a request on. */
const REMOTE_MIN_QUERY = 3;
const REMOTE_MAX_ROWS = 6;

/**
 * Everything the palette's local index cannot answer: titles and people that
 * are not in the watchlist.
 *
 * Called only when the client has decided it is worth it — three characters,
 * a pause in typing, and few local hits. The floor is repeated here because a
 * server action is a public endpoint, and a one-letter query would otherwise
 * reach both TMDB and the scraper.
 *
 * Cost is mostly the scraper: TMDB is free and Next caches each distinct query
 * for an hour, so a repeated search is a cache read rather than a round trip.
 */
export async function searchPaletteRemote(query: string): Promise<PaletteRemoteItem[]> {
    const trimmed = query.trim();
    if (trimmed.length < REMOTE_MIN_QUERY) return [];

    const results = await mediaService.search(trimmed).catch(() => null);
    if (!results) return [];

    const media: PaletteRemoteItem[] = results.media.slice(0, REMOTE_MAX_ROWS).map((item) => ({
        key: item.id,
        kind: "media",
        title: item.title,
        detail: [item.type === "MOVIE" ? "Movie" : "Series", item.year, item.originCountry].filter(Boolean).join(" · "),
        image: item.poster,
        href: `/media/${item.id}`,
    }));

    // People are already in the same response, so they cost nothing extra. The
    // local index only knows actors from shows on the list; this is how someone
    // reaches one they have never watched.
    const people: PaletteRemoteItem[] = results.people.slice(0, 3).map((person) => ({
        key: person.id,
        kind: "person",
        title: person.name,
        detail: person.knownForDepartment || "Person",
        image: person.profileImage,
        href: personHref({ mdlSlug: person.source === "MDL" ? person.externalId : null, tmdbId: person.externalId }) ?? "#",
    }));

    return [...media, ...people];
}
