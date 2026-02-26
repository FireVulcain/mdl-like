"use server";

import { prisma } from "@/lib/prisma";

export async function getPublicUser(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
    });
}

export async function getPublicActivity(userId: string, limit = 20) {
    return prisma.activityLog.findMany({
        where: { userId, isBackfill: false },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            externalId: true,
            source: true,
            mediaType: true,
            title: true,
            poster: true,
            action: true,
            payload: true,
            createdAt: true,
        },
    });
}

export type PublicStats = {
    totalShows: number;
    totalMovies: number;
    watchTimeMinutes: number;
    avgScore: number | null;
    topGenres: { name: string; count: number }[];
    statusBreakdown: Record<string, number>;
};

export async function getPublicStats(userId: string): Promise<PublicStats> {
    const items = await prisma.userMedia.findMany({
        where: { userId },
        select: {
            mediaType: true,
            status: true,
            progress: true,
            score: true,
            genres: true,
        },
    });

    const totalShows = items.filter((i) => i.mediaType === "TV").length;
    const totalMovies = items.filter((i) => i.mediaType === "MOVIE").length;

    // Rough estimate: 45 min per episode for TV, 100 min per movie
    const watchTimeMinutes = items.reduce((acc, item) => {
        if (item.mediaType === "MOVIE") return acc + 100;
        return acc + item.progress * 45;
    }, 0);

    const scored = items.filter((i) => i.score != null && i.score > 0);
    const avgScore =
        scored.length > 0
            ? Math.round((scored.reduce((acc, i) => acc + (i.score ?? 0), 0) / scored.length) * 10) / 10
            : null;

    const genreCount: Record<string, number> = {};
    items.forEach((item) => {
        if (item.genres) {
            item.genres.split(",").forEach((g) => {
                const genre = g.trim();
                if (genre) genreCount[genre] = (genreCount[genre] ?? 0) + 1;
            });
        }
    });
    const topGenres = Object.entries(genreCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const statusBreakdown: Record<string, number> = {};
    items.forEach((item) => {
        statusBreakdown[item.status] = (statusBreakdown[item.status] ?? 0) + 1;
    });

    return { totalShows, totalMovies, watchTimeMinutes, avgScore, topGenres, statusBreakdown };
}
