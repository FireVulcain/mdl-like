"use server";

import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/session";
import { kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";



function normalizeCast(members: KuryanaCastMember[]) {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

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

// Refresh media data from TMDB for items matching the given statuses (defaults to "Plan to Watch" + "Watching")
export async function refreshMediaData(ids: string[]) {
    const userId = await getCurrentUserId();

    if (ids.length === 0) return { success: true, count: 0, message: "No items selected" };

    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            id: { in: ids },
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

    // MDL season links let us fall back to MDL's air year when TMDB hasn't dated a
    // season yet (common for announced-only seasons — MDL often knows first).
    const seasonLinks = await prisma.mdlSeasonLink.findMany({
        where: { tmdbExternalId: { in: items.map((i) => i.externalId) }, season: { gt: 1 } },
        select: { tmdbExternalId: true, season: true, mdlSlug: true },
    });
    const mdlSlugBySeason = new Map(seasonLinks.map((l) => [`${l.tmdbExternalId}-${l.season}`, l.mdlSlug]));

    const mdlYearFromSlug = async (slug: string): Promise<number | null> => {
        try {
            const mdlDetails = await kuryanaGetDetails(slug);
            const fromYear = parseInt(mdlDetails?.data?.year ?? "");
            if (!Number.isNaN(fromYear) && fromYear > 1900) return fromYear;
            const aired = mdlDetails?.data?.details?.aired ?? mdlDetails?.data?.details?.airs;
            const match = aired?.match(/\b(19|20)\d{2}\b/);
            return match ? parseInt(match[0]) : null;
        } catch {
            return null;
        }
    };

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
                    // and air year — details.year is the show's FIRST air year, which is
                    // wrong for later seasons.
                    let totalEp = details.totalEp;
                    let year = details.year ? parseInt(details.year) : null;
                    let poster = details.poster;
                    if (details.type === "TV" && details.seasons && item.season > 0) {
                        const seasonData = details.seasons.find((s) => s.seasonNumber === item.season);
                        if (seasonData) {
                            totalEp = seasonData.episodeCount;
                            // Keep the season-specific poster that addToWatchlist picked —
                            // overwriting with the show poster loses per-season art
                            if (seasonData.poster) poster = seasonData.poster;
                            if (seasonData.airDate) {
                                year = parseInt(seasonData.airDate.slice(0, 4)) || year;
                            } else if (item.season > 1) {
                                // TMDB hasn't dated this season — try the linked MDL entry,
                                // else N/A (better than the show's first-air year)
                                const slug = mdlSlugBySeason.get(`${item.externalId}-${item.season}`);
                                year = slug ? await mdlYearFromSlug(slug) : null;
                            }
                        }
                    }

                    await prisma.userMedia.update({
                        where: { id: item.id },
                        data: {
                            title: details.title,
                            poster,
                            backdrop: item.backdrop || details.backdrop, // Keep existing backdrop if set
                            year,
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

// Force-refresh MDL ratings for all shows currently in the user's watchlist,
// bypassing the normal 7-day TTL. Uses existing MDL slugs when available to
// skip the search step and only re-fetch the details endpoint.
export async function refreshWatchlistMdlRatings(ids: string[]) {
    const userId = await getCurrentUserId();

    if (ids.length === 0) return { success: true, count: 0, skipped: 0 };

    // Fetch all distinct shows (externalId) among the selected watchlist items
    const rawItems = await prisma.userMedia.findMany({
        where: {
            userId,
            id: { in: ids },
        },
        select: { externalId: true, title: true, year: true },
        distinct: ["externalId"],
    });

    if (rawItems.length === 0) return { success: true, count: 0, skipped: 0 };

    const uniqueExternalIds = rawItems.map((i) => i.externalId);

    // Pre-load slugs to reuse known MDL slugs and skip the search step where possible
    const cachedRows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: uniqueExternalIds } },
        select: { tmdbExternalId: true, mdlSlug: true, mdlDisabled: true, cachedAt: true },
    });
    const cachedMap = new Map(cachedRows.map((r) => [r.tmdbExternalId, r]));

    // Only refresh shows that already have a confirmed MDL slug and are not disabled
    const itemsToRefresh = rawItems.filter((i) => {
        const cached = cachedMap.get(i.externalId);
        return cached?.mdlSlug && !cached.mdlDisabled;
    });
    const skipped = rawItems.length - itemsToRefresh.length;

    async function refreshOneItem(item: (typeof rawItems)[number]): Promise<boolean> {
        const slug = cachedMap.get(item.externalId)?.mdlSlug;
        if (!slug) return false;

        const [details, castResult] = await Promise.all([
            kuryanaGetDetails(slug, true),
            kuryanaGetCast(slug, true),
        ]);
        if (!details?.data) return false;

        const ranked = details.data.details?.ranked;
        const popularity = details.data.details?.popularity;
        const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
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
            where: { tmdbExternalId: item.externalId },
            data: {
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                ...(genres.length ? { genres: genres as unknown as Prisma.InputJsonValue } : {}),
                ...(cast ? { castJson: cast as unknown as Prisma.InputJsonValue } : {}),
                directors,
                screenwriters,
                cachedAt: new Date(),
            },
        });
        return true;
    }

    // Process in parallel batches of 3 to stay polite to Kuryana
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 500;
    let count = 0;
    for (let i = 0; i < itemsToRefresh.length; i += BATCH_SIZE) {
        const batch = itemsToRefresh.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(refreshOneItem));
        for (const r of results) {
            if (r.status === "fulfilled" && r.value) count++;
            else if (r.status === "rejected") console.error("[MDL Refresh] batch item failed:", r.reason);
        }
        if (i + BATCH_SIZE < itemsToRefresh.length) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
    }

    // Also refresh stale MdlSeasonLink rows (season 2+ with manual MDL links)
    const allSeasonLinks = await prisma.mdlSeasonLink.findMany({
        where: { tmdbExternalId: { in: uniqueExternalIds } },
        select: { tmdbExternalId: true, season: true, mdlSlug: true, cachedAt: true },
    });
    const staleSeasonLinks = allSeasonLinks;

    for (let i = 0; i < staleSeasonLinks.length; i += BATCH_SIZE) {
        const batch = staleSeasonLinks.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
            batch.map(async (link) => {
                try {
                    const details = await kuryanaGetDetails(link.mdlSlug, true);
                    if (details?.data) {
                        const ranked = details.data.details?.ranked;
                        const popularity = details.data.details?.popularity;
                        const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
                        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
                        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
                        const tags = details.data.others?.tags ?? [];
                        const genres = details.data.others?.genres ?? [];
                        await prisma.mdlSeasonLink.update({
                            where: { tmdbExternalId_season: { tmdbExternalId: link.tmdbExternalId, season: link.season } },
                            data: {
                                mdlRating, mdlRanking, mdlPopularity, tags,
                                ...(genres.length ? { genres: genres as unknown as Prisma.InputJsonValue } : {}),
                                cachedAt: new Date(),
                            },
                        });
                    }
                } catch (e) {
                    console.error(`[MDL Refresh] Failed season link ${link.tmdbExternalId} s${link.season}:`, e);
                }
            })
        );
        if (i + BATCH_SIZE < staleSeasonLinks.length) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count, skipped };
}

// Clear the next-episode cache for the selected watchlist items — useful when
// MDL fixes a wrong air date and the 6h freshness window would keep serving
// the stale one. CAUTION: CachedEpisode also stores the calendar's FULL
// episode schedules under "tmdb-<id>" keys; next-episode entries use the raw
// TMDB id, and only those may be deleted here.
export async function clearNextEpisodeCache(ids: string[]) {
    const userId = await getCurrentUserId();
    if (ids.length === 0) return { success: true, count: 0 };

    const items = await prisma.userMedia.findMany({
        where: { userId, id: { in: ids } },
        select: { externalId: true },
    });
    const mediaIds = [...new Set(items.map((i) => i.externalId))];
    if (mediaIds.length === 0) return { success: true, count: 0 };

    const { count } = await prisma.cachedEpisode.deleteMany({ where: { mediaId: { in: mediaIds } } });
    revalidatePath("/watchlist");
    return { success: true, count };
}
