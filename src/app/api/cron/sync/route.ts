import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";

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

        // Task 3: Update airing status for TV shows
        const airingResult = await runBackfillAiring();
        results.push(airingResult);

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

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
