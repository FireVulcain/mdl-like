import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData, MapLink, MapPerson } from "@/lib/character-map";

/** The chart stored for an MDL entry, or null. Cached per request. */
export const getCharacterMap = cache(async (mdlSlug: string | null | undefined): Promise<CharacterMapData | null> => {
    if (!mdlSlug) return null;
    try {
        const row = await prisma.characterMap.findUnique({ where: { mdlSlug } });
        return row ? (row.dataJson as unknown as CharacterMapData) : null;
    } catch {
        return null;
    }
});

/**
 * The MDL entry a media page is showing, for the season on screen. An MDL
 * page is its own entry; a TMDB page reaches one through the season link for
 * S2+ or the show-level cache for S1 — the same rule the rating and the aired
 * range follow, so the chart never describes a different season than they do.
 */
export const resolveMdlSlug = cache(async (id: string, season: number): Promise<string | null> => {
    if (id.startsWith("mdl-")) return id.slice(4);
    if (!id.startsWith("tmdb-")) return null;
    const tmdbExternalId = id.slice(5);
    try {
        if (season > 1) {
            const link = await prisma.mdlSeasonLink.findUnique({
                where: { tmdbExternalId_season: { tmdbExternalId, season } },
                select: { mdlSlug: true },
            });
            return link?.mdlSlug ?? null;
        }
        const cached = await prisma.cachedMdlData.findUnique({ where: { tmdbExternalId }, select: { mdlSlug: true, mdlDisabled: true } });
        return cached && !cached.mdlDisabled ? cached.mdlSlug : null;
    } catch {
        return null;
    }
});

export type Closest = { person: MapPerson; lead: MapPerson; link: MapLink };

/**
 * The handful of relations the media page shows inline: each person in the
 * compact cut with a family, romance or rivalry link to a lead — the answer to
 * "who is who" — leads first by link type, then in cast order. Reveals are
 * left out when the reader hides spoilers.
 */
export function closestRelations(map: CharacterMapData, hideSpoilers: boolean, limit = 8): Closest[] {
    const byId = new Map(map.people.map((p) => [p.id, p]));
    const leads = new Set(map.compact.center ?? map.main.slice(0, 2));
    const keep = new Set(map.compact.people);
    const rank: Record<string, number> = { romance: 0, family: 1, rivalry: 2, bond: 3 };
    const seen = new Set<string>();
    const out: Closest[] = [];
    const candidates = map.links
        .filter((l) => l.type in rank && !l.inferred && (!hideSpoilers || !l.reveal))
        .filter((l) => leads.has(l.from) !== leads.has(l.to) && keep.has(l.from) && keep.has(l.to))
        .sort((a, b) => rank[a.type] - rank[b.type]);
    for (const link of candidates) {
        const personId = leads.has(link.from) ? link.to : link.from;
        if (seen.has(personId)) continue;
        const person = byId.get(personId), lead = byId.get(leads.has(link.from) ? link.from : link.to);
        if (!person || !lead) continue;
        seen.add(personId);
        out.push({ person, lead, link });
        if (out.length >= limit) break;
    }
    return out;
}
