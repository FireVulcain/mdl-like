"use server";

import { prisma } from "@/lib/prisma";
import { type DashboardStats, EMPTY_STATS } from "@/types/stats";

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
    const items = await prisma.userMedia.findMany({
        where: { userId },
    });

    if (items.length === 0) {
        return EMPTY_STATS;
    }

    const movies = items.filter((i) => i.mediaType === "MOVIE");
    const tv = items.filter((i) => i.mediaType === "TV");

    // Watch Time Estimations (can be refined)
    // Movie: 120min, TV Episode: 45min
    const movieTime = movies.reduce((acc, m) => acc + (m.status === "Completed" || m.progress > 0 ? 120 : 0), 0);
    const tvTime = tv.reduce((acc, t) => acc + t.progress * 45, 0);
    const totalEpisodes = tv.reduce((acc, t) => acc + t.progress, 0);

    // Completion Rate
    const completed = items.filter((i) => i.status === "Completed").length;
    const started = items.filter((i) => i.status !== "Plan to Watch").length;
    const completionRate = started > 0 ? (completed / started) * 100 : 0;

    // Genre Breakdown
    const genreMap = new Map<string, number>();
    items.forEach((i) => {
        if (i.genres) {
            i.genres.split(",").forEach((g) => {
                const trimmed = g.trim();
                if (trimmed) {
                    genreMap.set(trimmed, (genreMap.get(trimmed) || 0) + 1);
                }
            });
        }
    });

    const genreData = Array.from(genreMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

    const topGenres = genreData.slice(0, 5).map((g) => ({
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

    return {
        totalMovies: movies.length,
        totalTV: tv.length,
        totalEpisodes,
        watchTimeMinutes: movieTime + tvTime,
        completionRate,
        currentStreak: items.length > 0 ? 3 : 0, // Mocked for demonstration
        genreBreakdown: genreData,
        ratingDistribution: ratings,
        monthlyActivity: [],
        activityHeatmap: [],
        topGenres,
        decadeDistribution: [],
    };
}

export async function getContinueWatching(userId: string) {
    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            mediaType: "TV",
            status: "Watching",
            progress: { gt: 0 },
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
    });

    return items.map((item) => ({
        id: item.id,
        title: item.title,
        poster: item.poster || "",
        backdrop: item.backdrop,
        progress: item.progress,
        totalEp: item.totalEp || 1,
        externalId: item.externalId,
        source: item.source,
    }));
}

export async function backfillGenres(userId: string) {
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
            // TMDB IDs are numeric in our storage usually, or stored as externalId
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            const details = await mediaService.getDetails(mediaId);
            if (details && details.genres) {
                await prisma.userMedia.update({
                    where: { id: item.id },
                    data: { genres: details.genres.join(",") },
                });
                count++;
            }
            // Small delay to be nice to API
            await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
            console.error(`Failed to backfill ${item.title}`, e);
        }
    }

    return { success: true, count };
}
