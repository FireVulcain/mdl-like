"use server";

import { unstable_cache, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { kuryanaSearch } from "@/lib/kuryana";
import { computeActorRadar, computeRadarActors, type ActorRadarPayload, type ActorRadarPerson } from "@/lib/actor-radar";

export type { ActorRadarItem, ActorRadarPayload, ActorRadarPerson } from "@/lib/actor-radar";

// Remove an actor from the radar's favorites; their slots go to the next-best actors.
export async function excludeRadarActor(personSlug: string, name: string, profileImage: string | null) {
    const userId = await getCurrentUserId();
    await prisma.$transaction([
        // Removing wins over a manual pin
        prisma.actorRadarPin.deleteMany({ where: { userId, personSlug } }),
        prisma.actorRadarExclusion.upsert({
            where: { userId_personSlug: { userId, personSlug } },
            create: { userId, personSlug, name, profileImage },
            update: { name, profileImage },
        }),
    ]);
    updateTag(`actor-radar-${userId}`);
    return { success: true };
}

// Manually add an actor to the radar — always scanned, regardless of affinity.
export async function pinRadarActor(personSlug: string, name: string, profileImage: string | null) {
    const userId = await getCurrentUserId();
    await prisma.$transaction([
        // Adding wins over a previous exclusion
        prisma.actorRadarExclusion.deleteMany({ where: { userId, personSlug } }),
        prisma.actorRadarPin.upsert({
            where: { userId_personSlug: { userId, personSlug } },
            create: { userId, personSlug, name, profileImage },
            update: { name, profileImage },
        }),
    ]);
    updateTag(`actor-radar-${userId}`);
    return { success: true };
}

export async function unpinRadarActor(personSlug: string) {
    const userId = await getCurrentUserId();
    await prisma.actorRadarPin.deleteMany({ where: { userId, personSlug } });
    updateTag(`actor-radar-${userId}`);
    return { success: true };
}

// Search MDL people for the "add actor" picker
export async function searchRadarPeople(query: string): Promise<{ slug: string; name: string; profileImage: string | null; nationality: string }[]> {
    await getCurrentUserId(); // auth gate
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const result = await kuryanaSearch(trimmed);
    return (result?.results?.people ?? []).slice(0, 8).map((p) => ({
        slug: p.slug,
        name: p.name,
        profileImage: p.thumb || null,
        nationality: p.nationality,
    }));
}

export async function restoreRadarActor(personSlug: string) {
    const userId = await getCurrentUserId();
    await prisma.actorRadarExclusion.deleteMany({ where: { userId, personSlug } });
    updateTag(`actor-radar-${userId}`);
    return { success: true };
}

/**
 * The two actor lists the settings panel shows, read straight from the database.
 *
 * Deliberately not getActorRadar(): every add or remove invalidates the radar's
 * tag, so re-reading the full payload right after one meant recomputing what the
 * day-long cache is there to avoid — a filmography per scanned actor and a
 * details fetch per recommendation, all to redraw two lists that never needed
 * either. The home page still goes through the cache; only this panel skips it.
 */
export async function getRadarActors(): Promise<{ scannedActors: ActorRadarPerson[]; excludedActors: ActorRadarPerson[] }> {
    const userId = await getCurrentUserId();
    const { topActors, excludedActors } = await computeRadarActors(userId);
    return {
        scannedActors: topActors.map((a) => ({ slug: a.slug, name: a.name, profileImage: a.profileImage, pinned: a.pinned })),
        excludedActors,
    };
}

export async function getActorRadar(): Promise<ActorRadarPayload> {
    const userId = await getCurrentUserId();

    // "v2" busts stale entries whenever the payload shape changes
    const cached = unstable_cache(() => computeActorRadar(userId), ["actor-radar", "v2", userId], {
        revalidate: 60 * 60 * 24,
        tags: [`actor-radar-${userId}`],
    });
    const payload = await cached();

    // The cached payload can be up to a day old — re-check against the CURRENT
    // watchlist so a just-added show disappears from the radar immediately.
    const currentIds = new Set(
        (await prisma.userMedia.findMany({ where: { userId }, select: { externalId: true } })).map((m) => m.externalId),
    );
    return {
        ...payload,
        items: payload.items.filter((i) => !i.tmdbId || !currentIds.has(i.tmdbId)),
        excludedActors: payload.excludedActors ?? [],
    };
}
