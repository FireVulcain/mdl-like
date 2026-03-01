"use server";

import { prisma } from "@/lib/prisma";
import { tmdb, TMDB_CONFIG, TMDBMedia } from "@/lib/tmdb";
import { kuryanaGetDetails, kuryanaGetCast } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";
import { MdlCast, MdlCastMember } from "@/lib/mdl-data";
import { KuryanaCastMember } from "@/lib/kuryana";

export interface TmdbSearchResult {
    externalId: string; // TMDB numeric ID as string
    title: string;
    year: string;
    poster: string | null;
    type: "TV" | "Movie";
    country: string;
    rating: number;
}

export async function searchTmdbDramas(query: string): Promise<TmdbSearchResult[]> {
    if (!query.trim()) return [];
    const result = await tmdb.searchMulti(query);
    return (result.results.filter((item) => item.media_type === "tv" || item.media_type === "movie") as TMDBMedia[])
        .slice(0, 12)
        .map((item) => ({
            externalId: item.id.toString(),
            title: (item.title || item.name) ?? "Unknown",
            year: ((item.release_date || item.first_air_date) ?? "").slice(0, 4),
            poster: item.poster_path ? TMDB_CONFIG.w342Image(item.poster_path) : null,
            type: item.media_type === "tv" ? "TV" : "Movie",
            country: item.origin_country?.[0] ?? "",
            rating: item.vote_average ?? 0,
        }));
}

function normalizeCast(members: KuryanaCastMember[]): MdlCastMember[] {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

// Returns the native title (e.g. "환혼") extracted from Kuryana's sub_title field.
// Used to pre-fill the TMDB search with a name that gives better results.
export async function getMdlNativeTitle(mdlSlug: string): Promise<string | null> {
    const details = await kuryanaGetDetails(mdlSlug);
    const sub = details?.data?.sub_title;
    if (!sub) return null;
    const native = sub.split("‧")[0].trim();
    return native || null;
}

// Checks if a TMDB ID is already linked and returns available seasons from TMDB.
// Used to decide whether to go through the normal flow or the season-picker flow.
export async function checkAndGetSeasons(tmdbExternalId: string): Promise<{
    alreadyLinked: boolean;
    seasons: { number: number; name: string }[];
    takenSeasons: number[]; // seasons already saved in MdlSeasonLink
}> {
    const existing = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId },
        select: { mdlSlug: true },
    });

    if (!existing) return { alreadyLinked: false, seasons: [], takenSeasons: [] };

    const [tmdbDetails, seasonLinks] = await Promise.all([
        tmdb.getDetails("tv", tmdbExternalId),
        prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId },
            select: { season: true },
        }),
    ]);

    const seasons = (tmdbDetails?.seasons ?? [])
        .filter((s) => s.season_number > 0)
        .map((s) => ({ number: s.season_number, name: s.name || `Season ${s.season_number}` }));

    const takenSeasons = [1, ...seasonLinks.map((l) => l.season)]; // season 1 = main CachedMdlData entry

    return { alreadyLinked: true, seasons, takenSeasons };
}

// Saves a season-specific MDL link (season 2+) into MdlSeasonLink.
export async function createMdlSeasonLink(
    mdlSlug: string,
    tmdbExternalId: string,
    season: number,
): Promise<{ ok: boolean; error?: string }> {
    try {
        const [details, castResult] = await Promise.all([
            kuryanaGetDetails(mdlSlug),
            kuryanaGetCast(mdlSlug),
        ]);

        const ranked = details?.data?.details?.ranked;
        const popularity = details?.data?.details?.popularity;
        const mdlRating = details?.data?.rating != null ? parseFloat(String(details.data.rating)) || null : null;
        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
        const tags = details?.data?.others?.tags ?? [];

        const cast: MdlCast | null = castResult?.data?.casts
            ? {
                  main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                  support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                  guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
              }
            : null;

        await prisma.mdlSeasonLink.upsert({
            where: { tmdbExternalId_season: { tmdbExternalId, season } },
            create: {
                tmdbExternalId,
                season,
                mdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
                cachedAt: new Date(),
            },
            update: {
                mdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
                cachedAt: new Date(),
            },
        });

        return { ok: true };
    } catch (e) {
        console.error("[MDL season link] Failed:", e);
        return { ok: false, error: "Failed to fetch MDL data. Try again." };
    }
}

// Creates (or updates) a CachedMdlData entry by fetching fresh data from Kuryana.
// Called after the user manually picks a TMDB match in the link modal.
export async function createMdlLink(mdlSlug: string, tmdbExternalId: string): Promise<{ ok: boolean; error?: string }> {
    try {
        const [details, castResult] = await Promise.all([
            kuryanaGetDetails(mdlSlug),
            kuryanaGetCast(mdlSlug),
        ]);

        const ranked = details?.data?.details?.ranked;
        const popularity = details?.data?.details?.popularity;
        const mdlRating = details?.data?.rating != null ? parseFloat(String(details.data.rating)) || null : null;
        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
        const tags = details?.data?.others?.tags ?? [];

        const cast: MdlCast | null = castResult?.data?.casts
            ? {
                  main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                  support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                  guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
              }
            : null;

        await prisma.cachedMdlData.upsert({
            where: { tmdbExternalId },
            create: {
                tmdbExternalId,
                mdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
            },
            update: {
                mdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
                cachedAt: new Date(),
            },
        });

        return { ok: true };
    } catch (e) {
        console.error("[MDL link] Failed:", e);
        return { ok: false, error: "Failed to fetch MDL data. Try again." };
    }
}
