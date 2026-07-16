import { prisma } from "@/lib/prisma";

export type CachedNextEpisode = {
    airDate: string;
    airDateTime: string | null; // exact ISO instant when the source knew it
    episodeNumber: number;
    seasonNumber: number;
    episodeName: string | null;
    // How fresh this entry is — callers can decide whether to trigger a background refresh
    updatedAt: Date;
};

// Air schedules rarely move intra-day, and MDL gives the exact broadcast time;
// aired episodes are filtered out at read time anyway, which forces a refetch.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Look up next-episode data from the DB cache.
 * Returns the cached entry if found (regardless of staleness) and a flag indicating freshness.
 *
 * `fromDate` (YYYY-MM-DD) is the caller's "today" — pass the user's LOCAL date, not
 * the server's UTC date. Otherwise, between the user's midnight and UTC midnight, a
 * yesterday-dated episode still counts as "upcoming" and occludes today's episode.
 */
export async function getCachedNextEpisodes(
    keys: Array<{ mediaId: string; seasonNumber: number }>,
    fromDate?: string,
): Promise<Map<string, CachedNextEpisode & { fresh: boolean }>> {
    if (keys.length === 0) return new Map();

    const mediaIds = [...new Set(keys.map((k) => k.mediaId))];
    const cutoffDate = fromDate ?? new Date().toISOString().split("T")[0];

    // Fetch the soonest future episode per (mediaId, seasonNumber)
    const rows = await prisma.cachedEpisode.findMany({
        where: {
            mediaId: { in: mediaIds },
            airDate: { gte: cutoffDate },
        },
        orderBy: { airDate: "asc" },
    });

    const result = new Map<string, CachedNextEpisode & { fresh: boolean }>();

    for (const { mediaId, seasonNumber } of keys) {
        const key = `${mediaId}-${seasonNumber}`;
        const match = rows.find((r) => r.mediaId === mediaId && r.seasonNumber === seasonNumber);
        if (match) {
            result.set(key, {
                airDate: match.airDate,
                airDateTime: match.airDateTime,
                episodeNumber: match.episodeNumber,
                seasonNumber: match.seasonNumber,
                episodeName: match.episodeName,
                updatedAt: match.updatedAt,
                fresh: Date.now() - match.updatedAt.getTime() < CACHE_TTL_MS,
            });
        }
    }

    return result;
}

/**
 * Upsert a next-episode entry into the cache.
 * Uses the unique constraint (mediaId, seasonNumber, episodeNumber).
 */
/**
 * Like getCachedNextEpisodes, but keyed by mediaId only: returns the soonest
 * future episode per media across ALL seasons. Used by the home page rows,
 * where the exact season doesn't matter (and unlinked MDL shows are cached
 * under `mdl-<slug>` keys with whatever season TVmaze reports).
 */
export async function getCachedNextEpisodesByMediaId(
    mediaIds: string[],
    fromDate?: string,
): Promise<Map<string, CachedNextEpisode>> {
    if (mediaIds.length === 0) return new Map();
    const cutoffDate = fromDate ?? new Date().toISOString().split("T")[0];

    const rows = await prisma.cachedEpisode.findMany({
        where: {
            mediaId: { in: [...new Set(mediaIds)] },
            airDate: { gte: cutoffDate },
        },
        orderBy: { airDate: "asc" },
    });

    const result = new Map<string, CachedNextEpisode>();
    for (const row of rows) {
        if (result.has(row.mediaId)) continue; // rows are sorted, first hit is the soonest
        result.set(row.mediaId, {
            airDate: row.airDate,
            airDateTime: row.airDateTime,
            episodeNumber: row.episodeNumber,
            seasonNumber: row.seasonNumber,
            episodeName: row.episodeName,
            updatedAt: row.updatedAt,
        });
    }
    return result;
}

export async function upsertCachedNextEpisode(data: {
    mediaId: string;
    airDate: string;
    airDateTime?: string | null;
    episodeNumber: number;
    seasonNumber: number;
    episodeName?: string | null;
}): Promise<void> {
    await prisma.cachedEpisode.upsert({
        where: {
            mediaId_seasonNumber_episodeNumber: {
                mediaId: data.mediaId,
                seasonNumber: data.seasonNumber,
                episodeNumber: data.episodeNumber,
            },
        },
        update: {
            airDate: data.airDate,
            airDateTime: data.airDateTime ?? null,
            episodeName: data.episodeName ?? null,
            updatedAt: new Date(),
        },
        create: {
            mediaId: data.mediaId,
            airDate: data.airDate,
            airDateTime: data.airDateTime ?? null,
            episodeNumber: data.episodeNumber,
            seasonNumber: data.seasonNumber,
            episodeName: data.episodeName ?? null,
        },
    });
}
