"use server";

import { prisma } from "@/lib/prisma"; // Need to create this
import { UnifiedMedia } from "@/services/media.service";
import { revalidatePath } from "next/cache";
import { tmdb } from "@/lib/tmdb";

// Ensure we have a singleton Prisma client
// We need to create src/lib/prisma.ts first if not exists, but I'll assume I need to create it.
// Actually, I'll create it in the next step or use the one generated if standard, but best practice is a singleton.

export async function addToWatchlist(
    userId: string,
    media: UnifiedMedia,
    status: string = "Plan to Watch",
    season: number = 1,
    totalEpForSeason?: number,
    initialData?: {
        progress?: number;
        score?: number;
        notes?: string;
    }
) {
    if (!userId) throw new Error("Unauthorized");

    try {
        const existing = await prisma.userMedia.findFirst({
            where: {
                userId,
                externalId: media.externalId,
                source: media.source,
                season: season,
            },
        });

        // If totalEpForSeason is provided (from season selector), use it.
        // Otherwise fallback to media.totalEp if likely a movie or single season, or just media.totalEp if undefined.
        const epCount = totalEpForSeason || media.totalEp || null;

        // Determine correct poster
        // If we have seasons data and we are adding a specific season
        let displayPoster = media.poster;
        if (media.seasons && season) {
            const seasonData = media.seasons.find((s) => s.seasonNumber === season);
            if (seasonData && seasonData.poster) {
                displayPoster = seasonData.poster;
            }
        }

        if (existing) {
            return await prisma.userMedia.update({
                where: { id: existing.id },
                data: {
                    status,
                    progress: initialData?.progress ?? existing.progress,
                    score: initialData?.score ?? existing.score,
                    notes: initialData?.notes ?? existing.notes,
                    lastWatchedAt: status === "Watching" || initialData?.progress !== undefined ? new Date() : undefined,
                    // Update cached metadata
                    totalEp: epCount,
                    title: media.title,
                    poster: displayPoster,
                    backdrop: media.backdrop || media.poster || null,
                    year: media.year ? parseInt(media.year) : null,
                    originCountry: media.originCountry,
                    genres: media.genres?.join(","),
                    airingStatus: media.status || null,
                },
            });
        }

        const newItem = await prisma.userMedia.create({
            data: {
                userId,
                externalId: media.externalId,
                source: media.source,
                mediaType: media.type,
                status,
                progress: initialData?.progress || 0,
                score: initialData?.score,
                notes: initialData?.notes,
                season,
                // Cache metadata
                title: media.title,
                poster: displayPoster,
                backdrop: media.backdrop || media.poster || null,
                year: media.year ? parseInt(media.year) : null,
                originCountry: media.originCountry,
                totalEp: epCount,
                genres: media.genres?.join(","),
                airingStatus: media.status || null,
                lastWatchedAt: status === "Watching" || (initialData?.progress ?? 0) > 0 ? new Date() : null,
            },
        });

        revalidatePath("/watchlist");
        return newItem;
    } catch (error) {
        console.error("Failed to add to watchlist:", error);
        throw new Error("Failed to add to watchlist");
    }
}

export async function updateProgress(id: string, progress: number) {
    try {
        const updated = await prisma.userMedia.update({
            where: { id },
            data: { 
                progress,
                lastWatchedAt: new Date()
            },
        });
        revalidatePath("/watchlist");
        return updated;
    } catch (error) {
        console.error("Failed to update progress:", error);
        throw new Error("Failed to update progress");
    }
}

export async function deleteUserMedia(id: string) {
    try {
        await prisma.userMedia.delete({ where: { id } });
        revalidatePath("/watchlist");
        revalidatePath("/media/[id]"); // We ideally need to know the media ID, but revalidatePath for a route pattern works broadly or we rely on specific path.
        // Actually revalidatePath with [id] layout doesn't work like glob.
        // We would need the externalId to revalidate specific page.
        // For now, watchlist is main priority.
    } catch (error) {
        console.error("Failed to delete user media:", error);
        throw new Error("Failed to delete user media");
    }
}

export async function updateUserMedia(id: string, data: Partial<any>) {
    // Using any simply to avoid tight coupling with type def repetition, but safer to use type
    try {
        const { status, progress, score, notes } = data;
        const updated = await prisma.userMedia.update({
            where: { id },
            data: {
                status,
                progress,
                score,
                notes,
                lastWatchedAt: (status !== undefined || progress !== undefined) ? new Date() : undefined,
            },
        });
        revalidatePath("/watchlist");
        return updated;
    } catch (error) {
        console.error("Failed to update user media:", error);
        throw new Error("Failed to update user media");
    }
}

// Helper to optimize TMDB image URLs (convert original to w1280 for backdrops)
function optimizeImageUrl(url: string | null): string | null {
    if (!url) return null;
    // Replace /original/ with /w1280/ for TMDB backdrop images
    return url.replace("/t/p/original/", "/t/p/w1280/");
}

type NextEpisodeData = {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
};

export async function getWatchlist(userId: string) {
    if (!userId) return []; // or throw

    const items = await prisma.userMedia.findMany({
        where: { userId },
        // We'll sort in memory to handle the custom status order
    });

    const statusWeight: Record<string, number> = {
        Watching: 1,
        Completed: 2,
        "Plan to Watch": 3,
        "On Hold": 4,
        Dropped: 5,
    };

    // Fetch next episode data for "Watching" items that are airing
    const watchingAiringItems = items.filter(
        (item) =>
            item.status === "Watching" &&
            item.airingStatus === "Returning Series" &&
            item.mediaType === "TV" &&
            item.source === "TMDB"
    );

    // Create a map to store next episode data, keyed by externalId
    const nextEpisodeMap = new Map<string, { nextEpisode: NextEpisodeData | null; seasonAirDate: string | null }>();

    // Fetch next episode data in parallel (batched)
    if (watchingAiringItems.length > 0) {
        const fetchPromises = watchingAiringItems.map(async (item) => {
            try {
                const details = await tmdb.getDetails("tv", item.externalId);
                const nextEpisode = details.next_episode_to_air
                    ? {
                          airDate: details.next_episode_to_air.air_date,
                          episodeNumber: details.next_episode_to_air.episode_number,
                          seasonNumber: details.next_episode_to_air.season_number,
                          name: details.next_episode_to_air.name,
                      }
                    : null;

                // Find the season air date for the current season the user is watching
                const seasonData = details.seasons?.find((s) => s.season_number === item.season);
                const seasonAirDate = seasonData?.air_date || details.first_air_date || null;

                nextEpisodeMap.set(`${item.externalId}-${item.season}`, { nextEpisode, seasonAirDate });
            } catch (error) {
                console.error(`Failed to fetch next episode for ${item.title}:`, error);
            }
        });

        await Promise.all(fetchPromises);
    }

    return items
        .map((item) => {
            const episodeData = nextEpisodeMap.get(`${item.externalId}-${item.season}`);
            return {
                ...item,
                // Optimize backdrop URLs for better performance
                backdrop: optimizeImageUrl(item.backdrop),
                // Add next episode data for watching items
                nextEpisode: episodeData?.nextEpisode || null,
                seasonAirDate: episodeData?.seasonAirDate || null,
            };
        })
        .sort((a, b) => {
            const weightA = statusWeight[a.status] || 99;
            const weightB = statusWeight[b.status] || 99;

            if (weightA !== weightB) {
                return weightA - weightB;
            }

            // Secondary sort by Title
            const titleDiff = (a.title || "").localeCompare(b.title || "");
            if (titleDiff !== 0) {
                return titleDiff;
            }

            // Tertiary sort by Season
            return (a.season || 1) - (b.season || 1);
        });
}
