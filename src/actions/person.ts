"use server";

import { tmdb, type TMDBPerson, type TMDBPersonCredits } from "@/lib/tmdb";

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
        const [person, credits] = await Promise.all([
            tmdb.getPersonDetails(id),
            tmdb.getPersonCombinedCredits(id),
        ]);
        return { person, credits };
    } catch {
        return { person: null, credits: null };
    }
}
