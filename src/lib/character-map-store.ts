import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { isEvent, type CharacterMapData, type MapLink, type MapPerson } from "@/lib/character-map";

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

/**
 * Where the reader stands with this media, by the watchlist: whether they
 * have finished it, and how many episodes they have watched. A finished
 * show gets the chart with everything open — inferred links and reveals —
 * since there is nothing left to spoil; anything else opens guarded, and a
 * chart dated by episode opens on the reader's episode. An MDL page also
 * checks the TMDB entry it is linked to, and the other way round, the way
 * the media page finds its watchlist row.
 */
export const watchState = cache(async (id: string, season: number): Promise<{ completed: boolean; progress: number | null }> => {
    const none = { completed: false, progress: null };
    let userId: string;
    try {
        userId = await getCurrentUserId();
    } catch {
        return none;
    }
    const source = id.startsWith("mdl-") ? "MDL" : id.startsWith("tmdb-") ? "TMDB" : null;
    if (!source) return none;
    const externalId = id.slice(source === "MDL" ? 4 : 5);
    const keys: { externalId: string; source: string }[] = [{ externalId, source }];
    try {
        if (source === "MDL") {
            const linked = await prisma.cachedMdlData.findFirst({ where: { mdlSlug: externalId }, select: { tmdbExternalId: true } });
            if (linked) keys.push({ externalId: linked.tmdbExternalId, source: "TMDB" });
        } else {
            const cached = await prisma.cachedMdlData.findUnique({ where: { tmdbExternalId: externalId }, select: { mdlSlug: true } });
            if (cached) keys.push({ externalId: cached.mdlSlug, source: "MDL" });
        }
        const row = await prisma.userMedia.findFirst({ where: { userId, season, OR: keys }, select: { status: true, progress: true } });
        return row ? { completed: row.status === "Completed", progress: row.progress } : none;
    } catch {
        return none;
    }
});

/**
 * Whether this reader has opened the twists on this chart before, or null
 * when they have never worked the door — then it opens the way it always
 * did, by whether they have finished the show. Signed out, there is nobody
 * to remember, so it is null as well.
 */
export const revealsOpened = cache(async (mdlSlug: string | null | undefined): Promise<boolean | null> => {
    if (!mdlSlug) return null;
    try {
        const userId = await getCurrentUserId();
        const row = await prisma.characterMapView.findUnique({ where: { userId_mdlSlug: { userId, mdlSlug } }, select: { reveals: true } });
        return row?.reveals ?? null;
    } catch {
        return null;
    }
});

export type Closest = { person: MapPerson; lead: MapPerson; link: MapLink };

/**
 * The handful of relations the media page shows inline: each person in the
 * compact cut with a link to a lead — the answer to "who is who". Family,
 * romance and rivalry links with a sentence behind them come first; the rest
 * (inferred links, and the work / friend types) fill the remaining slots, so
 * a chart written from a cast list alone still shows faces here instead of
 * an empty row beside a full map. Reveals are left out when the reader hides
 * spoilers.
 */
export function closestRelations(map: CharacterMapData, hideSpoilers: boolean, limit = 8): Closest[] {
    const byId = new Map(map.people.map((p) => [p.id, p]));
    const leads = new Set(map.compact.center ?? map.main.slice(0, 2));
    const keep = new Set(map.compact.people);
    const rank: Record<string, number> = { romance: 0, family: 1, rivalry: 2, bond: 3, work: 4, friend: 5 };
    const seen = new Set<string>();
    const out: Closest[] = [];
    const candidates = map.links
        // ties only — a moment is not what someone is to a lead — and the
        // ones that still hold before the ones that ended
        .filter((l) => !isEvent(l) && l.type in rank && (!hideSpoilers || !l.reveal))
        .filter((l) => leads.has(l.from) !== leads.has(l.to) && keep.has(l.from) && keep.has(l.to))
        // sourced before inferred; within each, the closer kinds of tie first
        .sort((a, b) => Number(a.inferred) - Number(b.inferred) || Number(a.until != null) - Number(b.until != null) || rank[a.type] - rank[b.type]);
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
