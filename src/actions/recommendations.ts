"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { tmdb } from "@/lib/tmdb";
import { ActivityAction } from "@/types/activity";
import {
    buildTasteProfile,
    scoreCandidates,
    pickTopDiverse,
    type RecMediaItem,
} from "@/lib/recommendation";
import type { Prisma } from "@prisma/client";

export type RecommendationPick = {
    id: string;
    externalId: string;
    source: string;
    season: number;
    title: string | null;
    poster: string | null;
    year: number | null;
    originCountry: string | null;
    score: number;
    reasons: string[];
};

export type RecommendationsPayload = {
    // Every Plan to Watch row, ranked best-first — used for the "Recommended" sort
    ranked: { id: string; score: number; reasons: string[] }[];
    // Diversified top picks for the "What to watch next" dialog
    topPicks: RecommendationPick[];
    watchedCount: number;
};

type CastEntry = { slug?: string; name?: string };

function parseCast(raw: Prisma.JsonValue | null): { main: CastEntry[]; support: CastEntry[] } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { main: [], support: [] };
    const obj = raw as { main?: CastEntry[]; support?: CastEntry[] };
    return { main: obj.main ?? [], support: obj.support ?? [] };
}

function parseTagNames(raw: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap((t) => {
        if (typeof t === "string") return [t];
        if (t && typeof t === "object" && "name" in t) return [(t as { name: string }).name];
        return [];
    });
}

function parseNameList(raw: Prisma.JsonValue | null | undefined): string[] {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).filter((n): n is string => typeof n === "string" && n.length > 0);
}

function parseGenres(raw: Prisma.JsonValue | null, tmdbGenres: string | null): string[] {
    if (Array.isArray(raw) && raw.length > 0) return (raw as string[]).map((g) => g.trim()).filter(Boolean);
    if (tmdbGenres) return tmdbGenres.split(",").map((g) => g.trim()).filter(Boolean);
    return [];
}

export async function getRecommendations(): Promise<RecommendationsPayload> {
    const userId = await getCurrentUserId();

    const [userMedia, podiums] = await Promise.all([
        prisma.userMedia.findMany({ where: { userId } }),
        prisma.profilePodium.findMany({ where: { userId }, select: { externalId: true } }),
    ]);

    if (userMedia.length === 0) return { ranked: [], topPicks: [], watchedCount: 0 };

    const externalIds = Array.from(new Set(userMedia.map((m) => m.externalId)));
    const podiumIds = new Set(podiums.map((p) => p.externalId));
    const ptwRows = userMedia.filter((m) => m.status === "Plan to Watch");

    const [mdlRows, addLogs] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: externalIds } },
            select: {
                tmdbExternalId: true,
                mdlRating: true,
                mdlPopularity: true,
                tags: true,
                genres: true,
                castJson: true,
                directors: true,
                screenwriters: true,
            },
        }),
        // When each Plan to Watch row was added — recent adds signal current interest
        prisma.activityLog.findMany({
            where: {
                userId,
                action: ActivityAction.ADDED,
                userMediaId: { in: ptwRows.map((r) => r.id) },
            },
            select: { userMediaId: true, createdAt: true },
            orderBy: { createdAt: "desc" },
        }),
    ]);

    const mdlByExternalId = new Map(mdlRows.map((r) => [r.tmdbExternalId, r]));
    const addedAtByMediaId = new Map<string, Date>();
    for (const log of addLogs) {
        if (log.userMediaId && !addedAtByMediaId.has(log.userMediaId)) {
            addedAtByMediaId.set(log.userMediaId, log.createdAt);
        }
    }

    const toRecItem = (m: (typeof userMedia)[number]): RecMediaItem => {
        const mdl = mdlByExternalId.get(m.externalId);
        const cast = parseCast(mdl?.castJson ?? null);
        return {
            id: m.id,
            externalId: m.externalId,
            source: m.source,
            season: m.season,
            title: m.title,
            poster: m.poster,
            year: m.year,
            originCountry: m.originCountry,
            mediaType: m.mediaType,
            status: m.status,
            score: m.score,
            totalEp: m.totalEp,
            tmdbRating: m.tmdbRating,
            airingStatus: m.airingStatus,
            lastWatchedAt: m.lastWatchedAt,
            updatedAt: m.updatedAt,
            genres: parseGenres(mdl?.genres ?? null, m.genres),
            tags: parseTagNames(mdl?.tags ?? null),
            mainCast: cast.main.filter((c) => c.slug).map((c) => ({ slug: c.slug!, name: c.name ?? c.slug! })),
            supportCast: cast.support.filter((c) => c.slug).map((c) => ({ slug: c.slug!, name: c.name ?? c.slug! })),
            directors: parseNameList(mdl?.directors),
            screenwriters: parseNameList(mdl?.screenwriters),
            mdlRating: mdl?.mdlRating ?? m.mdlRating,
            mdlPopularity: mdl?.mdlPopularity ?? null,
            isPodium: podiumIds.has(m.externalId),
            addedAt: addedAtByMediaId.get(m.id) ?? null,
        };
    };

    const allItems = userMedia.map(toRecItem);
    const profile = buildTasteProfile(allItems);

    // Candidates: Plan to Watch only. Skip later seasons of shows where an earlier
    // season is also PTW — recommending "S3" before S1 is watched makes no sense.
    const ptwItems = allItems.filter((i) => i.status === "Plan to Watch");
    const minPtwSeason = new Map<string, number>();
    for (const i of ptwItems) {
        const cur = minPtwSeason.get(i.externalId);
        if (cur === undefined || i.season < cur) minPtwSeason.set(i.externalId, i.season);
    }
    let candidates = ptwItems.filter((i) => i.season === minPtwSeason.get(i.externalId));

    // Release check. UserMedia.year is the show's FIRST air year, so a season-2+ row
    // can look released while that season actually airs years later — fetch the real
    // season air date from TMDB (cheap: only season-2+ rows, cached 1h). Unreleased
    // titles can't be "watched next", so they're dropped from the candidate set.
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const unreleased = new Set<string>();
    await Promise.all(
        candidates
            .filter((c) => c.season > 1 && c.mediaType === "TV" && c.source === "TMDB")
            .map(async (c) => {
                try {
                    const details = await tmdb.getDetails("tv", c.externalId);
                    const season = details.seasons?.find((s) => s.season_number === c.season);
                    if (!season) return;
                    if (season.air_date) {
                        if (season.air_date > today) unreleased.add(c.id);
                        else c.year = parseInt(season.air_date.slice(0, 4)); // true season year for era fit + display
                    } else if (season.episode_count === 0) {
                        unreleased.add(c.id); // announced but nothing aired yet
                    }
                } catch {
                    // TMDB hiccup: keep the candidate rather than silently hiding it
                }
            }),
    );
    candidates = candidates.filter(
        (c) =>
            !unreleased.has(c.id) &&
            !(c.year && c.year > currentYear) &&
            // TMDB show statuses meaning nothing has aired yet
            c.airingStatus !== "In Production" &&
            c.airingStatus !== "Planned",
    );

    const ranked = scoreCandidates(profile, candidates);

    const itemsById = new Map(candidates.map((i) => [i.id, i]));
    const topPicks = pickTopDiverse(ranked, itemsById, 5).map((r) => {
        const item = itemsById.get(r.id)!;
        return {
            id: r.id,
            externalId: item.externalId,
            source: item.source,
            season: item.season,
            title: item.title,
            poster: item.poster,
            year: item.year,
            originCountry: item.originCountry,
            score: r.score,
            reasons: r.reasons,
        };
    });

    return { ranked, topPicks, watchedCount: profile.watchedCount };
}
