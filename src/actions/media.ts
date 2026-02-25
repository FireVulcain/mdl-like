"use server";

import { prisma } from "@/lib/prisma"; // Need to create this
import { UnifiedMedia } from "@/services/media.service";
import { revalidatePath } from "next/cache";
import { tmdb, TMDBExternalIds } from "@/lib/tmdb";
import { tvmaze } from "@/lib/tvmaze";
import { ActivityAction, ActivityActionType } from "@/types/activity";
import { Prisma } from "@prisma/client";
import { getCurrentUserId } from "@/lib/session";

// Upsert progress log: within a 30-min window, update the existing entry rather than
// create a new one. This means a misclick that corrects ep 16 → 15 rewrites the log
// to show ep 15 (or deletes it entirely if back to the original starting point).
async function upsertProgressLog(data: {
    userId: string;
    userMediaId: string;
    externalId: string;
    source: string;
    mediaType: string;
    title: string;
    poster?: string | null;
    previousProgress: number;
    newProgress: number;
}) {
    if (data.previousProgress === data.newProgress) return;

    try {
        const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
        const recentLog = await prisma.activityLog.findFirst({
            where: {
                userMediaId: data.userMediaId,
                action: ActivityAction.PROGRESS,
                createdAt: { gte: thirtyMinsAgo },
            },
            orderBy: { createdAt: "desc" },
        });

        if (recentLog) {
            const originalFrom = ((recentLog.payload as Record<string, unknown>)?.from as number) ?? 0;
            if (data.newProgress <= originalFrom) {
                // Fully corrected back — remove the log entirely
                await prisma.activityLog.delete({ where: { id: recentLog.id } });
            } else {
                // Partial correction — update the "to" value in place
                await prisma.activityLog.update({
                    where: { id: recentLog.id },
                    data: { payload: { from: originalFrom, to: data.newProgress } as Prisma.InputJsonValue },
                });
            }
        } else if (data.newProgress > data.previousProgress) {
            // No recent log — create a fresh one (only for forward progress)
            await logActivity({
                userId: data.userId,
                userMediaId: data.userMediaId,
                externalId: data.externalId,
                source: data.source,
                mediaType: data.mediaType,
                title: data.title,
                poster: data.poster,
                action: ActivityAction.PROGRESS,
                payload: { from: data.previousProgress, to: data.newProgress },
            });
        }
    } catch (e) {
        console.error("[ActivityLog] Failed to upsert progress log:", e);
    }
}

async function logActivity(data: {
    userId: string;
    userMediaId: string | null;
    externalId: string;
    source: string;
    mediaType: string;
    title: string;
    poster?: string | null;
    action: ActivityActionType;
    payload?: Record<string, unknown>;
    isBackfill?: boolean;
}) {
    try {
        await prisma.activityLog.create({
            data: {
                userId: data.userId,
                userMediaId: data.userMediaId,
                externalId: data.externalId,
                source: data.source,
                mediaType: data.mediaType,
                title: data.title,
                poster: data.poster ?? null,
                action: data.action,
                payload: data.payload ? (data.payload as Prisma.InputJsonValue) : undefined,
                isBackfill: data.isBackfill ?? false,
            },
        });
    } catch (e) {
        console.error("[ActivityLog] Failed to write log:", e);
    }
}

// Ensure we have a singleton Prisma client
// We need to create src/lib/prisma.ts first if not exists, but I'll assume I need to create it.
// Actually, I'll create it in the next step or use the one generated if standard, but best practice is a singleton.

export async function addToWatchlist(
    media: UnifiedMedia,
    status: string = "Plan to Watch",
    season: number = 1,
    totalEpForSeason?: number,
    initialData?: {
        progress?: number;
        score?: number;
        notes?: string;
    },
) {
    const userId = await getCurrentUserId();

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
            const updated = await prisma.userMedia.update({
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
            if (existing.status !== status) {
                await logActivity({
                    userId,
                    userMediaId: existing.id,
                    externalId: media.externalId,
                    source: media.source,
                    mediaType: media.type,
                    title: media.title,
                    poster: displayPoster,
                    action: ActivityAction.STATUS_CHANGED,
                    payload: { from: existing.status, to: status },
                });
            }
            revalidatePath("/watchlist");
            revalidatePath("/history");
            return updated;
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

        await logActivity({
            userId,
            userMediaId: newItem.id,
            externalId: media.externalId,
            source: media.source,
            mediaType: media.type,
            title: media.title,
            poster: displayPoster,
            action: ActivityAction.ADDED,
            payload: { status, season },
        });

        revalidatePath("/watchlist");
        revalidatePath("/history");
        return newItem;
    } catch (error) {
        console.error("Failed to add to watchlist:", error);
        throw new Error("Failed to add to watchlist");
    }
}

export async function updateProgress(id: string, progress: number) {
    try {
        const current = await prisma.userMedia.findUnique({ where: { id } });
        const previousProgress = current?.progress ?? 0;

        const updated = await prisma.userMedia.update({
            where: { id },
            data: {
                progress,
                lastWatchedAt: new Date(),
            },
        });

        await upsertProgressLog({
            userId: updated.userId,
            userMediaId: id,
            externalId: updated.externalId,
            source: updated.source,
            mediaType: updated.mediaType,
            title: updated.title ?? "",
            poster: updated.poster,
            previousProgress,
            newProgress: progress,
        });

        revalidatePath("/watchlist");
        revalidatePath("/history");
        return updated;
    } catch (error) {
        console.error("Failed to update progress:", error);
        throw new Error("Failed to update progress");
    }
}

export async function deleteUserMedia(id: string) {
    try {
        const item = await prisma.userMedia.findUnique({ where: { id } });
        await prisma.userMedia.delete({ where: { id } });

        if (item) {
            await logActivity({
                userId: item.userId,
                userMediaId: null,
                externalId: item.externalId,
                source: item.source,
                mediaType: item.mediaType,
                title: item.title ?? "",
                poster: item.poster,
                action: ActivityAction.REMOVED,
            });
        }

        revalidatePath("/watchlist");
        revalidatePath("/history");
    } catch (error) {
        console.error("Failed to delete user media:", error);
        throw new Error("Failed to delete user media");
    }
}

export async function updateUserMedia(id: string, data: Partial<any>) {
    // Using any simply to avoid tight coupling with type def repetition, but safer to use type
    try {
        const current = await prisma.userMedia.findUnique({ where: { id } });
        const { status, progress, score, notes } = data;
        const updated = await prisma.userMedia.update({
            where: { id },
            data: {
                status,
                progress,
                score,
                notes,
                lastWatchedAt: status !== undefined || progress !== undefined ? new Date() : undefined,
            },
        });

        const base = {
            userId: updated.userId,
            userMediaId: id,
            externalId: updated.externalId,
            source: updated.source,
            mediaType: updated.mediaType,
            title: updated.title ?? "",
            poster: updated.poster,
        };

        if (status !== undefined && current?.status !== status) {
            await logActivity({ ...base, action: ActivityAction.STATUS_CHANGED, payload: { from: current?.status, to: status } });
        }
        if (progress !== undefined) {
            await upsertProgressLog({
                ...base,
                userMediaId: id,
                previousProgress: current?.progress ?? 0,
                newProgress: progress,
            });
        }
        if (score !== undefined && score > 0 && current?.score !== score) {
            await logActivity({ ...base, action: ActivityAction.SCORED, payload: { from: current?.score ?? null, to: score } });
        }
        if (notes !== undefined && notes && current?.notes !== notes) {
            await logActivity({ ...base, action: ActivityAction.NOTED });
        }

        revalidatePath("/watchlist");
        revalidatePath("/history");
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
    seasonEpisodeCount?: number; // Total episodes in season (from TVmaze, more accurate than TMDB)
};

export async function getWatchlist() {
    const userId = await getCurrentUserId();

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

    // Kick off MDL slug lookups immediately, in parallel with the TMDB/TVmaze fetches below
    const uniqueExternalIds = [...new Set(items.map((i) => i.externalId))];
    const mdlSlugPromise = Promise.all([
        prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: uniqueExternalIds } },
            select: { tmdbExternalId: true, mdlSlug: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId: { in: uniqueExternalIds } },
            select: { tmdbExternalId: true, season: true, mdlSlug: true },
        }),
    ]);

    // Fetch next episode data for "Watching" and "Plan to Watch" items that are airing
    const airingItems = items.filter(
        (item) =>
            (item.status === "Watching" || item.status === "Plan to Watch") &&
            (item.airingStatus === "Returning Series" || item.airingStatus === "In Production") &&
            item.mediaType === "TV" &&
            item.source === "TMDB",
    );

    // Create a map to store next episode data, keyed by externalId
    const nextEpisodeMap = new Map<string, { nextEpisode: NextEpisodeData | null; seasonAirDate: string | null }>();

    // Fetch next episode data in parallel (batched) using TVmaze with TMDB fallback
    if (airingItems.length > 0) {
        const fetchPromises = airingItems.map(async (item) => {
            try {
                // Get TMDB details for season air date and external IDs
                const details = await tmdb.getDetails("tv", item.externalId);
                const seasonData = details.seasons?.find((s) => s.season_number === item.season);
                const seasonAirDate = seasonData?.air_date || details.first_air_date || null;

                // Try to get next episode from TVmaze first
                let nextEpisode: NextEpisodeData | null = null;

                try {
                    // Get external IDs from TMDB
                    const externalIds = await tmdb.getExternalIds("tv", item.externalId);

                    // Try TVmaze lookup by IMDB ID first, then TVDB ID, then show name
                    if (externalIds?.imdb_id) {
                        nextEpisode = await tvmaze.getNextEpisodeByImdb(externalIds.imdb_id);
                    }
                    if (!nextEpisode && externalIds?.tvdb_id) {
                        nextEpisode = await tvmaze.getNextEpisodeByTvdb(externalIds.tvdb_id);
                    }
                    if (!nextEpisode && item.title) {
                        nextEpisode = await tvmaze.getNextEpisodeByName(item.title);
                    }
                } catch (tvmazeError) {
                    console.error(`TVmaze lookup failed for ${item.title}:`, tvmazeError);
                }

                // Fall back to TMDB if TVmaze doesn't have the data
                if (!nextEpisode && details.next_episode_to_air) {
                    nextEpisode = {
                        airDate: details.next_episode_to_air.air_date,
                        episodeNumber: details.next_episode_to_air.episode_number,
                        seasonNumber: details.next_episode_to_air.season_number,
                        name: details.next_episode_to_air.name,
                    };
                }

                nextEpisodeMap.set(`${item.externalId}-${item.season}`, { nextEpisode, seasonAirDate });
            } catch (error) {
                // 404 means the TMDB ID is stale/removed — skip silently
                const is404 = error instanceof Error && error.message.includes("404");
                if (!is404) {
                    console.warn(`Failed to fetch next episode for ${item.title}:`, error);
                }
            }
        });

        await Promise.all(fetchPromises);
    }

    // Await MDL slug data (likely already resolved by the time TMDB/TVmaze finishes)
    const [cachedMdlRows, seasonLinkRows] = await mdlSlugPromise;
    const mdlSlugByExternalId = new Map(cachedMdlRows.map((r) => [r.tmdbExternalId, r.mdlSlug]));
    const mdlSlugBySeason = new Map(seasonLinkRows.map((r) => [`${r.tmdbExternalId}-${r.season}`, r.mdlSlug]));

    return items
        .map((item) => {
            const episodeData = nextEpisodeMap.get(`${item.externalId}-${item.season}`);
            const mdlSlug =
                mdlSlugBySeason.get(`${item.externalId}-${item.season}`) ??
                mdlSlugByExternalId.get(item.externalId) ??
                null;
            return {
                ...item,
                // Optimize backdrop URLs for better performance
                backdrop: optimizeImageUrl(item.backdrop),
                // Add next episode data for watching items
                nextEpisode: episodeData?.nextEpisode || null,
                seasonAirDate: episodeData?.seasonAirDate || null,
                mdlSlug,
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
