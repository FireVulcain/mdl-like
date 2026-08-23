"use server";

import { prisma } from "@/lib/prisma";
import { type DashboardStats, EMPTY_STATS } from "@/types/stats";
import { getCurrentUserId } from "@/lib/session";

type UserMediaItem = Awaited<ReturnType<typeof prisma.userMedia.findMany>>[number];

// The watchlist header only shows watch time, completion rate and average score —
// all derivable from the rows it already has. Kept separate from getDashboardStats
// so the watchlist doesn't pay for the genre/theme/activity queries only /stats uses.
export type HeaderStats = Pick<DashboardStats, "watchTimeMinutes" | "completionRate" | "ratingDistribution">;

export async function getWatchlistHeaderStats(items: UserMediaItem[]): Promise<HeaderStats> {
    if (items.length === 0) {
        return {
            watchTimeMinutes: EMPTY_STATS.watchTimeMinutes,
            completionRate: EMPTY_STATS.completionRate,
            ratingDistribution: EMPTY_STATS.ratingDistribution,
        };
    }
    return {
        watchTimeMinutes: computeWatchTimeMinutes(items),
        completionRate: computeCompletionRate(items),
        ratingDistribution: computeRatingDistribution(items),
    };
}

// Shared with getDashboardStats so both surfaces always report the same numbers
function computeWatchTimeMinutes(items: UserMediaItem[]): number {
    // Movie: 120min, TV Episode: 45min — based on real progress, whatever the status
    const movieTime = items
        .filter((i) => i.mediaType === "MOVIE")
        .reduce((acc, m) => acc + (m.status === "Completed" || m.progress > 0 ? 120 : 0), 0);
    const tvTime = items.filter((i) => i.mediaType === "TV").reduce((acc, t) => acc + t.progress * 45, 0);
    return movieTime + tvTime;
}

function computeCompletionRate(items: UserMediaItem[]): number {
    const completed = items.filter((i) => i.status === "Completed").length;
    const started = items.filter((i) => i.status !== "Plan to Watch").length;
    return started > 0 ? (completed / started) * 100 : 0;
}

function computeRatingDistribution(items: UserMediaItem[]): { rating: number; count: number }[] {
    const ratings = Array.from({ length: 11 }, (_, i) => ({ rating: i, count: 0 }));
    items.forEach((i) => {
        if (i.score !== null) {
            const entry = ratings.find((r) => r.rating === Math.round(i.score!));
            if (entry) entry.count++;
        }
    });
    return ratings;
}

export async function getDashboardStats(existingItems?: UserMediaItem[]): Promise<DashboardStats> {
    const userId = await getCurrentUserId();
    const items = existingItems ?? await prisma.userMedia.findMany({
        where: { userId },
    });

    if (items.length === 0) {
        return EMPTY_STATS;
    }

    const movies = items.filter((i) => i.mediaType === "MOVIE");
    const tv = items.filter((i) => i.mediaType === "TV");

    const watchTimeMinutes = computeWatchTimeMinutes(items);
    const totalEpisodes = tv.reduce((acc, t) => acc + t.progress, 0);

    // "Watched" = finished or dropped (a dropped title was still watched, at least
    // partly). Plan to Watch and in-progress entries must not inflate the count.
    const isWatched = (status: string) => status === "Completed" || status === "Dropped";
    const watchedMovies = movies.filter((i) => isWatched(i.status)).length;
    const watchedTv = tv.filter((i) => isWatched(i.status)).length;

    const completionRate = computeCompletionRate(items);

    /**
     * Everything the user has actually started, which is what the distributions
     * below describe.
     *
     * A planned title is an intention, not a taste — often added on a trailer,
     * sometimes before a release date exists at all. Counting it under "By
     * Release Year" or "Top Genres" answers a question nobody asked: not what
     * someone watches, but what they once meant to.
     *
     * "Started" rather than the isWatched rule used further up, which is
     * Completed-or-Dropped: a show being watched right now says as much about
     * taste as one finished last year. computeCompletionRate already draws the
     * line in exactly this place.
     */
    const startedItems = items.filter((i) => i.status !== "Plan to Watch");
    const startedIds = new Set(startedItems.map((i) => i.externalId));

    // Genre Breakdown — prefer MDL genres when cached, fall back to TMDB genres
    const mdlGenreRows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: items.map((i) => i.externalId) } },
        select: { tmdbExternalId: true, genres: true, tags: true },
    });
    const mdlGenresByExternalId = new Map(
        mdlGenreRows
            .filter((r) => Array.isArray(r.genres) && (r.genres as string[]).length > 0)
            .map((r) => [r.tmdbExternalId, r.genres as string[]])
    );

    const genreMap = new Map<string, number>();
    startedItems.forEach((i) => {
        const mdlGenres = mdlGenresByExternalId.get(i.externalId);
        if (mdlGenres) {
            mdlGenres.forEach((g) => {
                const trimmed = g.trim();
                if (trimmed) genreMap.set(trimmed, (genreMap.get(trimmed) || 0) + 1);
            });
        } else if (i.genres) {
            i.genres.split(",").forEach((g) => {
                const trimmed = g.trim();
                if (trimmed) genreMap.set(trimmed, (genreMap.get(trimmed) || 0) + 1);
            });
        }
    });

    const genreData = Array.from(genreMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topGenres = genreData.slice(0, 8).map((g) => ({
        name: g.name,
        count: g.value,
        percentage: startedItems.length > 0 ? (g.value / startedItems.length) * 100 : 0,
    }));

    // Theme Breakdown — MDL tags, counted once per show (CachedMdlData is unique per
    // show, so season rows can't double-count). Tags Json can be legacy string[] or {id, name}[].
    const themeMap = new Map<string, number>();
    for (const row of mdlGenreRows) {
        if (!startedIds.has(row.tmdbExternalId)) continue;
        if (!Array.isArray(row.tags)) continue;
        const seen = new Set<string>();
        for (const t of row.tags as unknown[]) {
            const rawName = typeof t === "string" ? t : t && typeof t === "object" && "name" in t ? String((t as { name: unknown }).name) : "";
            const name = rawName.replace(/\s*\(.*?tags\)\s*$/i, "").trim();
            if (!name || seen.has(name)) continue;
            seen.add(name);
            themeMap.set(name, (themeMap.get(name) || 0) + 1);
        }
    }
    const topThemes = Array.from(themeMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 24);

    const ratings = computeRatingDistribution(items);

    // Country Breakdown
    const countryMap = new Map<string, number>();
    startedItems.forEach((i) => {
        if (i.originCountry) {
            countryMap.set(i.originCountry, (countryMap.get(i.originCountry) || 0) + 1);
        }
    });
    const countryBreakdown = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);

    // Year Breakdown (non-null years, last 25 years, sorted chronologically)
    const currentYear = new Date().getFullYear();
    const yearMap = new Map<number, number>();
    startedItems.forEach((i) => {
        if (i.year && i.year >= currentYear - 24 && i.year <= currentYear) {
            yearMap.set(i.year, (yearMap.get(i.year) || 0) + 1);
        }
    });
    const yearBreakdown = Array.from(yearMap.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year - b.year);

    // Activity Heatmap — past 365 days, real actions only (no backfill)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const activityLogs = await prisma.activityLog.findMany({
        where: {
            userId,
            isBackfill: false,
            createdAt: { gte: yearAgo },
        },
        select: { createdAt: true },
    });

    // Raw instants — the client buckets them into days using the viewer's timezone.
    // Bucketing here would use the server's UTC calendar and shift every cell.
    const activityTimestamps = activityLogs.map((log) => log.createdAt.toISOString());

    // Monthly Activity — past 12 months, real actions only
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyLogs = await prisma.activityLog.findMany({
        where: {
            userId,
            isBackfill: false,
            createdAt: { gte: twelveMonthsAgo },
        },
        select: { createdAt: true },
    });

    const monthMap = new Map<string, number>();
    // Pre-fill all 12 months so months with zero activity still appear
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthMap.set(key, 0);
    }
    monthlyLogs.forEach((log) => {
        const key = log.createdAt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    const monthlyActivity = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));

    return {
        totalMovies: watchedMovies,
        totalTV: watchedTv,
        totalEpisodes,
        watchTimeMinutes,
        completionRate,
        currentStreak: 0,
        genreBreakdown: genreData,
        ratingDistribution: ratings,
        monthlyActivity,
        activityTimestamps,
        topGenres,
        topThemes,
        decadeDistribution: [],
        countryBreakdown,
        yearBreakdown,
        topActors: [], // computed separately via getTopActors()
    };
}

export async function getTopActors(): Promise<DashboardStats["topActors"]> {
    const userId = await getCurrentUserId();

    // Anything started counts — you've seen the actor's face whether or not you
    // finished the show. Only Plan to Watch is excluded: those you haven't
    // watched at all. (Deliberately looser than the Completed-or-Dropped rule
    // used for watch time, which measures finished viewings, not exposure.)
    const userMedia = await prisma.userMedia.findMany({
        where: { userId, status: { not: "Plan to Watch" } },
        select: { externalId: true, season: true, title: true, source: true, poster: true, year: true },
    });

    if (userMedia.length === 0) return [];

    const externalIds = [...new Set(userMedia.map((m) => m.externalId))];

    // Two sources, because a show's cast changes between seasons: CachedMdlData
    // holds one row per show (the season-1 cast), MdlSeasonLink one per linked
    // season. Reading only the former made anyone promoted to lead in a later
    // season invisible — Go Youn Jung is supporting in Alchemy of Souls S1 but
    // heads the bill in S2.
    const [showRows, seasonRows] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: externalIds } },
            select: { tmdbExternalId: true, castJson: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId: { in: externalIds } },
            select: { tmdbExternalId: true, season: true, castJson: true },
        }),
    ]);

    type CastMember = { name: string; profileImage: string; slug: string; roleType: string };
    const showCast = new Map(showRows.map((r) => [r.tmdbExternalId, r.castJson]));
    const seasonCast = new Map(seasonRows.map((r) => [`${r.tmdbExternalId}-${r.season}`, r.castJson]));

    // Leads only. Supporting roles were tried and drowned the list in character
    // actors — the kind who appear in three scenes of every drama ever made —
    // pushing the leads the user actually recognises off the board entirely.
    const actorMap = new Map<string, DashboardStats["topActors"][number]>();
    const credited = new Set<string>(); // `${actorSlug}-${showId}` — a show counts once, however many of its seasons were watched

    for (const { externalId, season, title, source, poster, year } of userMedia) {
        const cast = (seasonCast.get(`${externalId}-${season}`) ?? showCast.get(externalId)) as
            | { main?: CastMember[] }
            | null
            | undefined;
        for (const member of cast?.main ?? []) {
            if (!member.slug) continue;
            const key = `${member.slug}-${externalId}`;
            if (credited.has(key)) continue;
            credited.add(key);

            // Collected in the same pass that counts, so the breakdown costs no
            // extra query — only the 12 rows that survive the slice are shipped.
            const show = { title: title || "Untitled", href: `/media/${source.toLowerCase()}-${externalId}`, poster, year };
            const existing = actorMap.get(member.slug);
            if (existing) {
                existing.count++;
                existing.shows.push(show);
            } else {
                actorMap.set(member.slug, {
                    name: member.name,
                    profileImage: member.profileImage ?? "",
                    slug: member.slug,
                    count: 1,
                    shows: [show],
                });
            }
        }
    }

    return Array.from(actorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 12)
        // Newest first — reads as a career timeline. Undated entries sink to the
        // bottom rather than leading the list, and ties fall back to the title so
        // the order is stable between renders.
        .map((a) => ({
            ...a,
            shows: a.shows.toSorted((x, y) => (y.year ?? 0) - (x.year ?? 0) || x.title.localeCompare(y.title)),
        }));
}

export async function getContinueWatching() {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            mediaType: "TV",
            status: "Watching",
            progress: { gt: 0 },
        },
        orderBy: [
            { lastWatchedAt: { sort: "desc", nulls: "last" } },
            { updatedAt: "desc" },
        ],
        take: 6,
    });

    return items.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster || "",
        backdrop: item.backdrop?.replace("/t/p/w1280/", "/t/p/original/") ?? null,
        progress: item.progress,
        totalEp: item.totalEp || 1,
        externalId: item.externalId,
        source: item.source,
    }));
}

export async function backfillGenres() {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            genres: null,
        },
    });

    if (items.length === 0) return { success: true, count: 0 };

    const { mediaService } = await import("@/services/media.service");

    let count = 0;
    for (const item of items) {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            const details = await mediaService.getDetails(mediaId);
            if (details && details.genres) {
                await prisma.userMedia.update({
                    where: { id: item.id },
                    data: { genres: details.genres.join(",") },
                });
                count++;
            }
            await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
            console.error(`Failed to backfill ${item.title}`, e);
        }
    }

    return { success: true, count };
}

export type DayActivityEntry = {
    id: string;
    action: string;
    title: string;
    poster: string | null;
    source: string;
    externalId: string;
    payload: unknown;
    at: string; // ISO instant; the client formats the time in its own zone
};

/**
 * The activity behind one heatmap cell, loaded on click rather than shipped
 * with the page — a year of entries with titles and posters is a lot of
 * payload for squares the user will almost never open.
 *
 * `dateKey` is a YYYY-MM-DD in the VIEWER's calendar and `tzOffsetMinutes` its
 * offset (JS convention: UTC − local, so France in summer sends -120). The day
 * boundary is resolved from those two, matching the client-side bucketing that
 * drew the cell in the first place.
 */
export async function getActivityForDay(dateKey: string, tzOffsetMinutes: number): Promise<DayActivityEntry[]> {
    const userId = await getCurrentUserId();
    if (!userId) return [];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
    const offset = Math.abs(tzOffsetMinutes) <= 14 * 60 ? tzOffsetMinutes : 0;

    const [y, m, d] = dateKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d) + offset * 60_000);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.activityLog.findMany({
        where: { userId, isBackfill: false, createdAt: { gte: start, lt: end } },
        orderBy: { createdAt: "desc" },
        select: {
            id: true,
            action: true,
            title: true,
            poster: true,
            source: true,
            externalId: true,
            payload: true,
            createdAt: true,
        },
    });

    return logs.map((l) => ({
        id: l.id,
        action: l.action,
        title: l.title,
        poster: l.poster,
        source: l.source,
        externalId: l.externalId,
        payload: l.payload,
        at: l.createdAt.toISOString(),
    }));
}
