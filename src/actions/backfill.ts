"use server";

import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";

export async function backfillBackdrops() {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            backdrop: null,
        },
    });

    if (items.length === 0) return { success: true, count: 0 };

    // Group items by show (source + externalId) to assign different backdrops per season
    const showGroups = new Map<string, typeof items>();
    for (const item of items) {
        const key = `${item.source}-${item.externalId}`;
        if (!showGroups.has(key)) {
            showGroups.set(key, []);
        }
        showGroups.get(key)!.push(item);
    }

    // Cache for API responses to avoid duplicate calls for same show
    const detailsCache = new Map<string, Awaited<ReturnType<typeof mediaService.getDetails>>>();

    let count = 0;
    for (const [key, groupItems] of showGroups) {
        try {
            const firstItem = groupItems[0];
            const mediaId = `${firstItem.source.toLowerCase()}-${firstItem.externalId}`;

            // Fetch details (use cache if available)
            let details = detailsCache.get(mediaId);
            if (!details) {
                details = await mediaService.getDetails(mediaId);
                if (details) {
                    detailsCache.set(mediaId, details);
                }
                // Small delay to be nice to API
                await new Promise((r) => setTimeout(r, 100));
            }

            if (details) {
                const mainBackdrop = details.backdrop || details.poster || null;
                // Filter out the main backdrop from the array to avoid duplicates
                const alternateBackdrops = (details.images?.backdrops || []).filter(
                    (b) => b !== mainBackdrop
                );

                // Sort seasons by season number
                groupItems.sort((a, b) => a.season - b.season);

                for (let i = 0; i < groupItems.length; i++) {
                    const item = groupItems[i];
                    // Season 1 gets main backdrop, others get from alternates
                    let backdrop: string | null;
                    if (i === 0 || alternateBackdrops.length === 0) {
                        backdrop = mainBackdrop;
                    } else {
                        // Cycle through alternate backdrops for other seasons
                        backdrop = alternateBackdrops[(i - 1) % alternateBackdrops.length] || mainBackdrop;
                    }

                    await prisma.userMedia.update({
                        where: { id: item.id },
                        data: {
                            backdrop,
                            title: item.title || details.title,
                            poster: item.poster || details.poster,
                        },
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`Failed to backfill backdrop for show ${key}`, e);
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count };
}

// Re-backfill all backdrops (even existing ones) to assign different images per season
export async function refreshAllBackdrops() {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: { userId },
    });

    if (items.length === 0) return { success: true, count: 0 };

    // Group items by show (source + externalId)
    const showGroups = new Map<string, typeof items>();
    for (const item of items) {
        const key = `${item.source}-${item.externalId}`;
        if (!showGroups.has(key)) {
            showGroups.set(key, []);
        }
        showGroups.get(key)!.push(item);
    }

    // Cache for API responses
    const detailsCache = new Map<string, Awaited<ReturnType<typeof mediaService.getDetails>>>();

    let count = 0;
    for (const [key, groupItems] of showGroups) {
        // Only process shows with multiple seasons
        if (groupItems.length <= 1) continue;

        try {
            const firstItem = groupItems[0];
            const mediaId = `${firstItem.source.toLowerCase()}-${firstItem.externalId}`;

            let details = detailsCache.get(mediaId);
            if (!details) {
                details = await mediaService.getDetails(mediaId);
                if (details) {
                    detailsCache.set(mediaId, details);
                }
                await new Promise((r) => setTimeout(r, 100));
            }

            if (details) {
                const mainBackdrop = details.backdrop || details.poster || null;
                // Filter out the main backdrop from the array to avoid duplicates
                const alternateBackdrops = (details.images?.backdrops || []).filter(
                    (b) => b !== mainBackdrop
                );

                // Sort by season number
                groupItems.sort((a, b) => a.season - b.season);

                for (let i = 0; i < groupItems.length; i++) {
                    const item = groupItems[i];
                    let backdrop: string | null;
                    if (i === 0 || alternateBackdrops.length === 0) {
                        backdrop = mainBackdrop;
                    } else {
                        backdrop = alternateBackdrops[(i - 1) % alternateBackdrops.length] || mainBackdrop;
                    }

                    await prisma.userMedia.update({
                        where: { id: item.id },
                        data: { backdrop },
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`Failed to refresh backdrops for show ${key}`, e);
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count };
}

// Backfill airing status for all items
export async function backfillAiringStatus() {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            airingStatus: null,
            mediaType: "TV", // Only TV shows have airing status
        },
    });

    if (items.length === 0) return { success: true, count: 0, message: "No items to update" };

    // Group by show to avoid duplicate API calls
    const showGroups = new Map<string, typeof items>();
    for (const item of items) {
        const key = `${item.source}-${item.externalId}`;
        if (!showGroups.has(key)) {
            showGroups.set(key, []);
        }
        showGroups.get(key)!.push(item);
    }

    const detailsCache = new Map<string, Awaited<ReturnType<typeof mediaService.getDetails>>>();

    let count = 0;
    for (const [key, groupItems] of showGroups) {
        try {
            const firstItem = groupItems[0];
            const mediaId = `${firstItem.source.toLowerCase()}-${firstItem.externalId}`;

            let details = detailsCache.get(mediaId);
            if (!details) {
                details = await mediaService.getDetails(mediaId);
                if (details) {
                    detailsCache.set(mediaId, details);
                }
                // Rate limiting
                await new Promise((r) => setTimeout(r, 100));
            }

            if (details?.status) {
                // Update all seasons of this show with the same airing status
                for (const item of groupItems) {
                    await prisma.userMedia.update({
                        where: { id: item.id },
                        data: { airingStatus: details.status },
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`Failed to backfill airing status for ${key}`, e);
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count, message: `Updated ${count} items` };
}

// Refresh media data from TMDB for "Plan to Watch" and "Watching" items
export async function refreshMediaData() {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            status: {
                in: ["Plan to Watch", "Watching"],
            },
        },
    });

    if (items.length === 0) return { success: true, count: 0, message: "No items to refresh" };

    // Group by show to avoid duplicate API calls
    const showGroups = new Map<string, typeof items>();
    for (const item of items) {
        const key = `${item.source}-${item.externalId}`;
        if (!showGroups.has(key)) {
            showGroups.set(key, []);
        }
        showGroups.get(key)!.push(item);
    }

    const detailsCache = new Map<string, Awaited<ReturnType<typeof mediaService.getDetails>>>();

    let count = 0;
    for (const [key, groupItems] of showGroups) {
        try {
            const firstItem = groupItems[0];
            const mediaId = `${firstItem.source.toLowerCase()}-${firstItem.externalId}`;

            let details = detailsCache.get(mediaId);
            if (!details) {
                details = await mediaService.getDetails(mediaId);
                if (details) {
                    detailsCache.set(mediaId, details);
                }
                // Rate limiting
                await new Promise((r) => setTimeout(r, 100));
            }

            if (details) {
                for (const item of groupItems) {
                    // For TV shows with seasons, get the specific season's episode count
                    let totalEp = details.totalEp;
                    if (details.type === "TV" && details.seasons && item.season > 0) {
                        const seasonData = details.seasons.find((s) => s.seasonNumber === item.season);
                        if (seasonData) {
                            totalEp = seasonData.episodeCount;
                        }
                    }

                    await prisma.userMedia.update({
                        where: { id: item.id },
                        data: {
                            title: details.title,
                            poster: details.poster,
                            backdrop: item.backdrop || details.backdrop, // Keep existing backdrop if set
                            year: details.year ? parseInt(details.year) : null,
                            totalEp: totalEp,
                            airingStatus: details.status,
                            genres: details.genres?.join(", ") || null,
                            tmdbRating: details.rating,
                        },
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`Failed to refresh media data for ${key}`, e);
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count, message: `Refreshed ${count} items` };
}
