"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { tvmaze } from "@/lib/tvmaze";
import { tmdb } from "@/lib/tmdb";

export type ScheduleEntry = {
    title: string;
    poster: string | null;
    episodeNumber: number;
    seasonNumber: number;
    episodeName?: string;
    airDate: string; // YYYY-MM-DD
    mediaId: string;
};

// TVmaze rate limit: 20 req/10s — cap concurrent show fetches at 3
async function withConcurrency<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
        await Promise.all(items.slice(i, i + concurrency).map(fn));
    }
}

async function fetchAndCacheEpisodes(
    mediaId: string,
    externalId: string,
    title: string | null,
): Promise<{ airDate: string; episodeNumber: number; seasonNumber: number; episodeName?: string }[]> {
    const externalIds = await tmdb.getExternalIds("tv", externalId);
    const episodes = await tvmaze.getAllEpisodes({
        imdbId: externalIds?.imdb_id,
        tvdbId: externalIds?.tvdb_id,
        showName: title,
    });

    if (episodes.length > 0) {
        await prisma.cachedEpisode.createMany({
            data: episodes.map((ep) => ({
                mediaId,
                airDate: ep.airDate,
                episodeNumber: ep.episodeNumber,
                seasonNumber: ep.seasonNumber,
                episodeName: ep.name || null,
            })),
            skipDuplicates: true,
        });
    }

    return episodes.map((ep) => ({
        airDate: ep.airDate,
        episodeNumber: ep.episodeNumber,
        seasonNumber: ep.seasonNumber,
        episodeName: ep.name,
    }));
}

export async function getScheduleEntries(userId: string): Promise<ScheduleEntry[]> {
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch", "Completed"] },
            mediaType: "TV",
            source: "TMDB",
            originCountry: { in: ["KR", "CN"] },
        },
        select: {
            externalId: true,
            source: true,
            title: true,
            poster: true,
        },
    });

    if (items.length === 0) return [];

    const results: ScheduleEntry[] = [];

    await withConcurrency(items, 3, async (item) => {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;

            // Serve from DB cache if available
            const cached = await prisma.cachedEpisode.findMany({ where: { mediaId } });
            if (cached.length > 0) {
                for (const ep of cached) {
                    results.push({
                        title: item.title || "Unknown",
                        poster: item.poster,
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: ep.seasonNumber,
                        episodeName: ep.episodeName ?? undefined,
                        airDate: ep.airDate,
                        mediaId,
                    });
                }
                return;
            }

            // Cache miss: fetch all episodes from TVmaze and persist
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
                });
            }
        } catch (error) {
            console.error(`Failed to get schedule for ${item.title}:`, error);
        }
    });

    return results.sort((a, b) => a.airDate.localeCompare(b.airDate));
}

export async function refreshScheduleCache(userId: string): Promise<void> {
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch"] },
            mediaType: "TV",
            source: "TMDB",
            originCountry: { in: ["KR", "CN"] },
        },
        select: {
            externalId: true,
            source: true,
            title: true,
        },
    });

    if (items.length === 0) return;

    // Clear existing cache for these shows
    const mediaIds = items.map((i) => `${i.source.toLowerCase()}-${i.externalId}`);
    await prisma.cachedEpisode.deleteMany({ where: { mediaId: { in: mediaIds } } });

    // Re-fetch and re-cache
    await withConcurrency(items, 3, async (item) => {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            await fetchAndCacheEpisodes(mediaId, item.externalId, item.title);
        } catch (error) {
            console.error(`Failed to refresh cache for ${item.title}:`, error);
        }
    });

    revalidatePath("/schedule");
}
