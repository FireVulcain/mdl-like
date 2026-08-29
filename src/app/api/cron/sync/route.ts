import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import { kuryanaGetDetails, kuryanaGetCast, kuryanaGetTop, parseMdlWatchers, KuryanaCastMember, type KuryanaTopSelection } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";
import { recordMdlRatingPoint } from "@/lib/mdl-rating-history";

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

        // Task 3: One rating reading for every currently-airing drama, so the
        // history is not confined to what somebody here happens to watch.
        //
        // Ahead of the watchlist refresh on purpose. That one is greedy by
        // design — it works down its queue until 270s of the 300s budget are
        // gone — so anything behind it would only run on days it happened to
        // finish early, which for a growing watchlist means never. This costs
        // one request per country and is over in seconds.
        const airingRatings = await runRecordAiringRatings(startTime);
        results.push(airingRatings);

        await delay(2000);

        // Task 4: Refresh stale MDL ratings (shows approaching their 7-day cache TTL)
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

/**
 * A daily reading for every drama currently airing, whether or not anybody here
 * is watching it.
 *
 * Everything else that feeds MdlRatingPoint is driven by the watchlist, so the
 * history was only ever going to describe one person's taste. Airing shows are
 * the opposite population and the better one: they collect votes fast, so their
 * ratings actually move — the back catalogue's do not, MDL publishing a single
 * decimal and those titles resting on tens of thousands of votes.
 *
 * The lists are already scraped for the home page, but reading them out of
 * CachedMdlTop would be wrong: that cache only refreshes when someone visits
 * the home page, so a stale figure would be stored under today's date and a
 * recorded day would stop meaning "we looked". This fetches its own, which
 * costs one request per country.
 *
 * Two countries, deliberately, and not whichever ones happen to be cached:
 * every country added is another daily request against a site that blocks us
 * when pushed. Korean and Chinese are where the watching actually happens here.
 * Widening this is a one-line change, and the cost of each line is known —
 * korean returns twenty shows with thirteen rated, chinese ten with five.
 *
 * Rating only. The list's `rank` is MDL's popularity rank — the app maps it to
 * `popularity`, and the values run into the tens of thousands — while our
 * `ranking` column holds the rating rank from `details.ranked`. Filing one
 * under the other would quietly corrupt every rank series we have.
 */
const AIRING_COUNTRIES: KuryanaTopSelection[] = ["korean", "chinese"];

async function runRecordAiringRatings(cronStart: number): Promise<TaskResult> {
    const taskStart = Date.now();
    const BUDGET_MS = 285_000;

    try {
        const seen = new Set<string>();
        let count = 0;

        for (const country of AIRING_COUNTRIES) {
            if (Date.now() - cronStart > BUDGET_MS) break;

            try {
                const res = await kuryanaGetTop(country, "ongoing", { sort: "popular" });
                for (const show of res?.data.shows ?? []) {
                    const slug = show.url?.replace(/^\//, "");
                    // A show that has just begun has no rating yet — too few
                    // votes for MDL to publish one. Storing the zero it comes
                    // back as would invent a reading of nought out of ten.
                    if (!slug || seen.has(slug) || !show.rating) continue;
                    seen.add(slug);
                    await recordMdlRatingPoint(slug, { rating: show.rating });
                    count++;
                }
            } catch (e) {
                console.error(`[Cron airing] Failed ${country}:`, e);
            }

            await delay(500);
        }

        return { task: "record-airing-ratings", success: true, count, duration: Date.now() - taskStart };
    } catch (error) {
        return {
            task: "record-airing-ratings",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - taskStart,
        };
    }
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
                    kuryanaGetDetails(row.mdlSlug, true),
                    kuryanaGetCast(row.mdlSlug, true),
                ]);

                if (details?.data) {
                    const ranked = details.data.details?.ranked;
                    const popularity = details.data.details?.popularity;
                    const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
                    const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
                    const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
                    const mdlWatchers = parseMdlWatchers(details.data.details?.watchers);
                    const aired = details.data.details?.airs ?? details.data.details?.aired ?? null;
                    const tags = details.data.others?.tags ?? [];
                    const genres = details.data.others?.genres ?? [];
                    const directors = details.data.others?.directors ?? [];
                    const screenwriters = details.data.others?.screenwriter ?? [];
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
                            mdlWatchers,
                            aired,
                            tags,
                            ...(genres.length ? { genres: genres as unknown as Prisma.InputJsonValue } : {}),
                            ...(cast ? { castJson: cast as unknown as Prisma.InputJsonValue } : {}),
                            directors,
                            screenwriters,
                            cachedAt: new Date(),
                        },
                    });
                    // The same reading, kept as history. The cron is what gives
                    // a series its regular spine — a page visit only lands a
                    // point on the days somebody happened to open that page.
                    await recordMdlRatingPoint(row.mdlSlug, { rating: mdlRating, ranking: mdlRanking, watchers: mdlWatchers });
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
                const details = await kuryanaGetDetails(link.mdlSlug, true);
                if (details?.data) {
                    const ranked = details.data.details?.ranked;
                    const popularity = details.data.details?.popularity;
                    const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
                    const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
                    const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
                    const mdlWatchers = parseMdlWatchers(details.data.details?.watchers);
                    const aired = details.data.details?.airs ?? details.data.details?.aired ?? null;
                    const tags = details.data.others?.tags ?? [];
                    const genres = details.data.others?.genres ?? [];

                    await prisma.mdlSeasonLink.update({
                        where: { tmdbExternalId_season: { tmdbExternalId: link.tmdbExternalId, season: link.season } },
                        data: {
                            mdlRating, mdlRanking, mdlPopularity, mdlWatchers, aired, tags,
                            ...(genres.length ? { genres: genres as unknown as Prisma.InputJsonValue } : {}),
                            cachedAt: new Date(),
                        },
                    });
                    await recordMdlRatingPoint(link.mdlSlug, { rating: mdlRating, ranking: mdlRanking, watchers: mdlWatchers });
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
