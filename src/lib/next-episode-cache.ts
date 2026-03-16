import { prisma } from "@/lib/prisma";

export type CachedNextEpisode = {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    episodeName: string | null;
    // How fresh this entry is — callers can decide whether to trigger a background refresh
    updatedAt: Date;
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Look up next-episode data from the DB cache.
 * Returns the cached entry if found (regardless of staleness) and a flag indicating freshness.
 */
export async function getCachedNextEpisodes(
    keys: Array<{ mediaId: string; seasonNumber: number }>,
): Promise<Map<string, CachedNextEpisode & { fresh: boolean }>> {
    if (keys.length === 0) return new Map();

    const mediaIds = [...new Set(keys.map((k) => k.mediaId))];
    const cutoff = new Date();

    // Fetch the soonest future episode per (mediaId, seasonNumber)
    const rows = await prisma.cachedEpisode.findMany({
        where: {
            mediaId: { in: mediaIds },
            airDate: { gte: cutoff.toISOString().split("T")[0] },
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
export async function upsertCachedNextEpisode(data: {
    mediaId: string;
    airDate: string;
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
            episodeName: data.episodeName ?? null,
            updatedAt: new Date(),
        },
        create: {
            mediaId: data.mediaId,
            airDate: data.airDate,
            episodeNumber: data.episodeNumber,
            seasonNumber: data.seasonNumber,
            episodeName: data.episodeName ?? null,
        },
    });
}
