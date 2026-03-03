"use server";

import { prisma } from "@/lib/prisma";
import { type DashboardStats, EMPTY_STATS } from "@/types/stats";
import { getCurrentUserId } from "@/lib/session";

type UserMediaItem = Awaited<ReturnType<typeof prisma.userMedia.findMany>>[number];

export async function getDashboardStats(existingItems?: UserMediaItem[]): Promise<DashboardStats> {
    const userId = await getCurrentUserId();
    const items = existingItems ?? await prisma.userMedia.findMany({
        where: { userId },
    });

    if (items.length === 0) {
        return EMPTY_STATS;
    }

    const movies = items.filter((i) => i.mediaType === "MOVIE");
    const tv = items.filter((i) => i.mediaType === "TV");

    // Watch Time Estimations
    // Movie: 120min, TV Episode: 45min
    const movieTime = movies.reduce((acc, m) => acc + (m.status === "Completed" || m.progress > 0 ? 120 : 0), 0);
    const tvTime = tv.reduce((acc, t) => acc + t.progress * 45, 0);
    const totalEpisodes = tv.reduce((acc, t) => acc + t.progress, 0);

    // Completion Rate
    const completed = items.filter((i) => i.status === "Completed").length;
    const started = items.filter((i) => i.status !== "Plan to Watch").length;
    const completionRate = started > 0 ? (completed / started) * 100 : 0;

    // Genre Breakdown — prefer MDL genres when cached, fall back to TMDB genres
    const mdlGenreRows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: items.map((i) => i.externalId) } },
        select: { tmdbExternalId: true, genres: true },
    });
    const mdlGenresByExternalId = new Map(
        mdlGenreRows
            .filter((r) => Array.isArray(r.genres) && (r.genres as string[]).length > 0)
            .map((r) => [r.tmdbExternalId, r.genres as string[]])
    );

    const genreMap = new Map<string, number>();
    items.forEach((i) => {
        const mdlGenres = mdlGenresByExternalId.get(i.externalId);
        if (mdlGenres) {
            mdlGenres.forEach((g) => {
                const trimmed = g.trim();
                if (trimmed) genreMap.set(trimmed, (genreMap.get(trimmed) || 0) + 1);
            });
        } else if (i.genres) {
            i.genres.split(",").forEach((g) => {
                const trimmed = g.trim();
                if (trimmed) genreMap.set(trimmed, (genreMap.get(trimmed) || 0) + 1);
            });
        }
    });

    const genreData = Array.from(genreMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topGenres = genreData.slice(0, 8).map((g) => ({
        name: g.name,
        count: g.value,
        percentage: items.length > 0 ? (g.value / items.length) * 100 : 0,
    }));

    // Rating Distribution
    const ratings = Array.from({ length: 11 }, (_, i) => ({ rating: i, count: 0 }));
    items.forEach((i) => {
        if (i.score !== null) {
            const rounded = Math.round(i.score);
            const entry = ratings.find((r) => r.rating === rounded);
            if (entry) entry.count++;
        }
    });

    // Country Breakdown
    const countryMap = new Map<string, number>();
    items.forEach((i) => {
        if (i.originCountry) {
            countryMap.set(i.originCountry, (countryMap.get(i.originCountry) || 0) + 1);
        }
    });
    const countryBreakdown = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);

    // Year Breakdown (non-null years, last 25 years, sorted chronologically)
    const currentYear = new Date().getFullYear();
    const yearMap = new Map<number, number>();
    items.forEach((i) => {
        if (i.year && i.year >= currentYear - 24 && i.year <= currentYear) {
            yearMap.set(i.year, (yearMap.get(i.year) || 0) + 1);
        }
    });
    const yearBreakdown = Array.from(yearMap.entries())
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => a.year - b.year);

    // Activity Heatmap — past 365 days, real actions only (no backfill)
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const activityLogs = await prisma.activityLog.findMany({
        where: {
            userId,
            isBackfill: false,
            createdAt: { gte: yearAgo },
        },
        select: { createdAt: true },
    });

    const heatmapMap = new Map<string, number>();
    activityLogs.forEach((log) => {
        const dateKey = log.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
        heatmapMap.set(dateKey, (heatmapMap.get(dateKey) || 0) + 1);
    });
    const activityHeatmap = Array.from(heatmapMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

    // Monthly Activity — past 12 months, real actions only
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    const monthlyLogs = await prisma.activityLog.findMany({
        where: {
            userId,
            isBackfill: false,
            createdAt: { gte: twelveMonthsAgo },
        },
        select: { createdAt: true },
    });

    const monthMap = new Map<string, number>();
    // Pre-fill all 12 months so months with zero activity still appear
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthMap.set(key, 0);
    }
    monthlyLogs.forEach((log) => {
        const key = log.createdAt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        monthMap.set(key, (monthMap.get(key) || 0) + 1);
    });
    const monthlyActivity = Array.from(monthMap.entries()).map(([month, count]) => ({ month, count }));

    return {
        totalMovies: movies.length,
        totalTV: tv.length,
        totalEpisodes,
        watchTimeMinutes: movieTime + tvTime,
        completionRate,
        currentStreak: 0,
        genreBreakdown: genreData,
        ratingDistribution: ratings,
        monthlyActivity,
        activityHeatmap,
        topGenres,
        decadeDistribution: [],
        countryBreakdown,
        yearBreakdown,
        topActors: [], // computed separately via getTopActors()
    };
}

export async function getTopActors(): Promise<{ name: string; profileImage: string; slug: string; count: number }[]> {
    const userId = await getCurrentUserId();

    const userMedia = await prisma.userMedia.findMany({
        where: { userId },
        select: { externalId: true },
    });

    if (userMedia.length === 0) return [];

    const externalIds = userMedia.map((m) => m.externalId);

    const cachedRows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: externalIds } },
        select: { castJson: true },
    });

    type CastMember = { name: string; profileImage: string; slug: string; roleType: string };
    const actorMap = new Map<string, { name: string; profileImage: string; slug: string; count: number }>();

    for (const row of cachedRows) {
        if (!row.castJson) continue;
        const cast = row.castJson as { main?: CastMember[] };
        for (const member of cast.main ?? []) {
            if (!member.slug) continue;
            const existing = actorMap.get(member.slug);
            if (existing) {
                existing.count++;
            } else {
                actorMap.set(member.slug, {
                    name: member.name,
                    profileImage: member.profileImage ?? "",
                    slug: member.slug,
                    count: 1,
                });
            }
        }
    }

    return Array.from(actorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);
}

export async function getContinueWatching() {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            mediaType: "TV",
            status: "Watching",
            progress: { gt: 0 },
        },
        orderBy: [
            { lastWatchedAt: { sort: "desc", nulls: "last" } },
            { updatedAt: "desc" },
        ],
        take: 6,
    });

    return items.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster || "",
        backdrop: item.backdrop?.replace("/t/p/w1280/", "/t/p/original/") ?? null,
        progress: item.progress,
        totalEp: item.totalEp || 1,
        externalId: item.externalId,
        source: item.source,
    }));
}

export async function backfillGenres() {
    const userId = await getCurrentUserId();
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            genres: null,
        },
    });

    if (items.length === 0) return { success: true, count: 0 };

    const { mediaService } = await import("@/services/media.service");

    let count = 0;
    for (const item of items) {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            const details = await mediaService.getDetails(mediaId);
            if (details && details.genres) {
                await prisma.userMedia.update({
                    where: { id: item.id },
                    data: { genres: details.genres.join(",") },
                });
                count++;
            }
            await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
            console.error(`Failed to backfill ${item.title}`, e);
        }
    }

    return { success: true, count };
}
