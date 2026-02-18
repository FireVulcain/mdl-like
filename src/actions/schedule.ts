"use server";

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

export async function getScheduleEntries(userId: string): Promise<ScheduleEntry[]> {
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: { in: ["Watching", "Plan to Watch"] },
            airingStatus: { in: ["Returning Series", "In Production"] },
            mediaType: "TV",
            source: "TMDB",
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

    await Promise.all(
        items.map(async (item) => {
            try {
                const externalIds = await tmdb.getExternalIds("tv", item.externalId);

                const upcoming = await tvmaze.getUpcomingEpisodes({
                    imdbId: externalIds?.imdb_id,
                    tvdbId: externalIds?.tvdb_id,
                    showName: item.title,
                });

                for (const ep of upcoming) {
                    results.push({
                        title: item.title || "Unknown",
                        poster: item.poster,
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: ep.seasonNumber,
                        episodeName: ep.name,
                        airDate: ep.airDate,
                        mediaId: `${item.source.toLowerCase()}-${item.externalId}`,
                    });
                }
            } catch (error) {
                console.error(`Failed to get schedule for ${item.title}:`, error);
            }
        }),
    );

    return results.sort((a, b) => a.airDate.localeCompare(b.airDate));
}
