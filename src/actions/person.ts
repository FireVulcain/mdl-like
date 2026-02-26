"use server";

import { tmdb, type TMDBPerson, type TMDBPersonCredits } from "@/lib/tmdb";
import { prisma } from "@/lib/prisma";

/** Batch-fetch MDL ratings from CachedMdlData for a list of TMDB IDs. */
export async function getMdlRatingsForTmdbIds(tmdbIds: string[]): Promise<Record<string, number>> {
    if (tmdbIds.length === 0) return {};
    const rows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: tmdbIds } },
        select: { tmdbExternalId: true, mdlRating: true },
    });
    const map: Record<string, number> = {};
    for (const r of rows) {
        if (r.mdlRating != null) map[r.tmdbExternalId] = r.mdlRating;
    }
    return map;
}

export async function getPersonDetails(id: string): Promise<TMDBPerson | null> {
    try {
        return await tmdb.getPersonDetails(id);
    } catch {
        return null;
    }
}

export async function getPersonCredits(id: string): Promise<TMDBPersonCredits | null> {
    try {
        return await tmdb.getPersonCombinedCredits(id);
    } catch {
        return null;
    }
}

export async function getPersonData(id: string): Promise<{ person: TMDBPerson | null; credits: TMDBPersonCredits | null }> {
    try {
        const [person, credits] = await Promise.all([tmdb.getPersonDetails(id), tmdb.getPersonCombinedCredits(id)]);
        return { person, credits };
    } catch {
        return { person: null, credits: null };
    }
}
