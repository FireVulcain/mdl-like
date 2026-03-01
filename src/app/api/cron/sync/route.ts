import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import { kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";

// Vercel cron jobs use this header for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export const maxDuration = 300; // 5 minutes max for Vercel Pro, 60s for Hobby
export const dynamic = "force-dynamic";

type TaskResult = {
    task: string;
    success: boolean;
    count?: number;
    matched?: number;
    scraped?: number;
    error?: string;
    duration?: number;
};

/**
 * Cron job that runs daily to sync watchlist data
 * Tasks are run sequentially with delays to respect Supabase free tier limits
 */
export async function GET(request: NextRequest) {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: TaskResult[] = [];
    const startTime = Date.now();

    try {
        // Task 1: Backfill missing backdrops
        const backdropResult = await runBackfillBackdrops();
        results.push(backdropResult);

        // Wait 2 seconds between tasks
        await delay(2000);

        // Task 2: Update airing status for TV shows
        const airingResult = await runBackfillAiring();
        results.push(airingResult);

        await delay(2000);

        // Task 3: Refresh stale MDL ratings (shows approaching their 7-day cache TTL)
        const mdlResult = await runRefreshMdlRatings(startTime);
        results.push(mdlResult);

        const totalDuration = Date.now() - startTime;

        // Log sync results to database
        await prisma.syncLog.upsert({
            where: { id: "daily-sync" },
            update: {
                lastSync: new Date(),
                results: {
                    tasks: results,
                    totalDuration,
                    timestamp: new Date().toISOString(),
                },
            },
            create: {
                id: "daily-sync",
                lastSync: new Date(),
                results: {
                    tasks: results,
                    totalDuration,
                    timestamp: new Date().toISOString(),
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: "Sync completed",
            results,
            totalDuration: `${(totalDuration / 1000).toFixed(2)}s`,
        });
    } catch (error) {
        console.error("Cron sync error:", error);

        // Still log the failure
        await prisma.syncLog.upsert({
            where: { id: "daily-sync" },
            update: {
                lastSync: new Date(),
                results: {
                    tasks: results,
                    error: error instanceof Error ? error.message : "Unknown error",
                    timestamp: new Date().toISOString(),
                },
            },
            create: {
                id: "daily-sync",
                lastSync: new Date(),
                results: {
                    tasks: results,
                    error: error instanceof Error ? error.message : "Unknown error",
                    timestamp: new Date().toISOString(),
                },
            },
        });

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                results,
            },
            { status: 500 }
        );
    }
}

async function runBackfillBackdrops(): Promise<TaskResult> {
    const taskStart = Date.now();
    try {
        const items = await prisma.userMedia.findMany({
            where: {
                backdrop: null,
            },
        });

        if (items.length === 0) {
            return {
                task: "backfill-backdrops",
                success: true,
                count: 0,
                duration: Date.now() - taskStart,
            };
        }

        // Group items by show
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
                    // Longer delay for cron to be extra safe with rate limits
                    await delay(150);
                }

                if (details) {
                    const mainBackdrop = details.backdrop || details.poster || null;
                    const alternateBackdrops = (details.images?.backdrops || []).filter(
                        (b) => b !== mainBackdrop
                    );

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

        return {
            task: "backfill-backdrops",
            success: true,
            count,
            duration: Date.now() - taskStart,
        };
    } catch (error) {
        return {
            task: "backfill-backdrops",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - taskStart,
        };
    }
}

async function runBackfillAiring(): Promise<TaskResult> {
    const taskStart = Date.now();
    try {
        const items = await prisma.userMedia.findMany({
            where: {
                airingStatus: null,
                mediaType: "TV",
            },
        });

        if (items.length === 0) {
            return {
                task: "backfill-airing",
                success: true,
                count: 0,
                duration: Date.now() - taskStart,
            };
        }

        // Group by show
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
                    await delay(150);
                }

                if (details?.status) {
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

        return {
            task: "backfill-airing",
            success: true,
            count,
            duration: Date.now() - taskStart,
        };
    } catch (error) {
        return {
            task: "backfill-airing",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - taskStart,
        };
    }
}

function normalizeCast(members: KuryanaCastMember[]) {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

// Refresh MDL ratings in two passes:
//   1. Priority: "Watching" + "Plan to Watch" shows — always refreshed regardless of cache age
//   2. Stale: remaining watchlist shows with cache ≥6 days old
// Stops early if the cron is running low on its 5-minute budget.
async function runRefreshMdlRatings(cronStart: number): Promise<TaskResult> {
    const taskStart = Date.now();
    const BUDGET_MS = 270_000; // stop if fewer than 30s remain in the 300s budget

    try {
        // --- Priority IDs: active shows any user is Watching or Plan to Watch ---
        const priorityItems = await prisma.userMedia.findMany({
            where: { status: { in: ["Watching", "Plan to Watch"] } },
            select: { externalId: true },
            distinct: ["externalId"],
        });
        const priorityIds = new Set(priorityItems.map((i) => i.externalId));

        // --- All watchlist IDs (for the stale pass) ---
        const allItems = await prisma.userMedia.findMany({
            select: { externalId: true },
            distinct: ["externalId"],
        });
        const allIds = new Set(allItems.map((i) => i.externalId));

        if (allIds.size === 0) {
            return { task: "refresh-mdl-ratings", success: true, count: 0, duration: Date.now() - taskStart };
        }

        // Fetch CachedMdlData slugs for priority IDs (no age filter — always refresh)
        const priorityRows = await prisma.cachedMdlData.findMany({
            where: {
                tmdbExternalId: { in: Array.from(priorityIds) },
                mdlSlug: { not: "" },
            },
            select: { tmdbExternalId: true, mdlSlug: true },
        });

        // Fetch stale CachedMdlData for the remaining IDs (≥6 days old only)
        const staleThreshold = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        const staleRows = await prisma.cachedMdlData.findMany({
            where: {
                tmdbExternalId: { in: Array.from(allIds), notIn: Array.from(priorityIds) },
                cachedAt: { lt: staleThreshold },
                mdlSlug: { not: "" },
            },
            select: { tmdbExternalId: true, mdlSlug: true },
        });

        // Process priority first, then stale
        const allRows = [...priorityRows, ...staleRows];

        let count = 0;
        for (const row of allRows) {
            if (Date.now() - cronStart > BUDGET_MS) break;

            try {
                const [details, castResult] = await Promise.all([
                    kuryanaGetDetails(row.mdlSlug),
                    kuryanaGetCast(row.mdlSlug),
                ]);

                if (details?.data) {
                    const ranked = details.data.details?.ranked;
                    const popularity = details.data.details?.popularity;
                    const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
                    const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
                    const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
                    const tags = details.data.others?.tags ?? [];
                    const cast = castResult?.data?.casts
                        ? {
                              main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                              support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                              guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
                          }
                        : undefined;

                    await prisma.cachedMdlData.update({
                        where: { tmdbExternalId: row.tmdbExternalId },
                        data: {
                            mdlRating,
                            mdlRanking,
                            mdlPopularity,
                            tags,
                            ...(cast ? { castJson: cast as unknown as Prisma.InputJsonValue } : {}),
                            cachedAt: new Date(),
                        },
                    });
                    count++;
                }
            } catch (e) {
                console.error(`[Cron MDL] Failed for ${row.tmdbExternalId}:`, e);
            }

            await delay(500);
        }

        // MdlSeasonLink pass: priority season links (no age filter) then stale ones
        const prioritySeasonLinks = await prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId: { in: Array.from(priorityIds) } },
            select: { tmdbExternalId: true, season: true, mdlSlug: true },
        });
        const staleSeasonLinks = await prisma.mdlSeasonLink.findMany({
            where: {
                tmdbExternalId: { in: Array.from(allIds), notIn: Array.from(priorityIds) },
                cachedAt: { lt: staleThreshold },
            },
            select: { tmdbExternalId: true, season: true, mdlSlug: true },
        });

        for (const link of [...prioritySeasonLinks, ...staleSeasonLinks]) {
            if (Date.now() - cronStart > BUDGET_MS) break;

            try {
                const details = await kuryanaGetDetails(link.mdlSlug);
                if (details?.data) {
                    const ranked = details.data.details?.ranked;
                    const popularity = details.data.details?.popularity;
                    const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
                    const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
                    const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
                    const tags = details.data.others?.tags ?? [];

                    await prisma.mdlSeasonLink.update({
                        where: { tmdbExternalId_season: { tmdbExternalId: link.tmdbExternalId, season: link.season } },
                        data: { mdlRating, mdlRanking, mdlPopularity, tags, cachedAt: new Date() },
                    });
                    count++;
                }
            } catch (e) {
                console.error(`[Cron MDL] Failed season link ${link.tmdbExternalId} s${link.season}:`, e);
            }

            await delay(500);
        }

        return { task: "refresh-mdl-ratings", success: true, count, duration: Date.now() - taskStart };
    } catch (error) {
        return {
            task: "refresh-mdl-ratings",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - taskStart,
        };
    }
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
