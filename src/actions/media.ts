"use server";

import { prisma } from "@/lib/prisma"; // Need to create this
import { UnifiedMedia } from "@/services/media.service";
import { revalidatePath } from "next/cache";

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
                    // Update cached metadata
                    totalEp: epCount,
                    title: media.title,
                    poster: displayPoster,
                    backdrop: media.backdrop || media.poster || null,
                    year: media.year ? parseInt(media.year) : null,
                    originCountry: media.originCountry,
                    genres: media.genres?.join(","),
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
            data: { progress },
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
            },
        });
        revalidatePath("/watchlist");
        return updated;
    } catch (error) {
        console.error("Failed to update user media:", error);
        throw new Error("Failed to update user media");
    }
}

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

    return items.sort((a, b) => {
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
