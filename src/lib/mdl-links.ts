import { prisma } from "@/lib/prisma";

/**
 * Where an MDL slug goes on this site.
 *
 * MDL's own payloads carry absolute mydramalist.com URLs; none of them are ever
 * followed. A slug we have linked to a TMDB entry opens that page — it is the
 * one carrying the user's progress and rating — and everything else opens the
 * MDL-native page, which this app renders itself.
 *
 * Three tables can carry the link, the same three /dramas reads: the show-level
 * cache, the per-season links (MDL files each season as its own entry), and the
 * aliases for the slugs MDL keeps under a second name.
 */
export async function resolveMdlHrefs(slugs: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(slugs.map((s) => s.replace(/^\//, "")))].filter(Boolean);
    const hrefs = new Map<string, string>(unique.map((slug) => [slug, `/media/mdl-${slug}`]));
    if (unique.length === 0) return hrefs;

    const [cached, seasons, aliases] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: unique } },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { mdlSlug: { in: unique } },
            select: { mdlSlug: true, tmdbExternalId: true, season: true },
        }),
        prisma.mdlAlias.findMany({
            where: { mdlSlug: { in: unique } },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
    ]);

    // Season links last: they are the most specific, and a slug that is both a
    // season entry and an alias should open on its own season.
    for (const row of [...aliases, ...cached]) {
        hrefs.set(row.mdlSlug, `/media/tmdb-${row.tmdbExternalId}`);
    }
    for (const row of seasons) {
        hrefs.set(row.mdlSlug, `/media/tmdb-${row.tmdbExternalId}${row.season > 1 ? `?season=${row.season}` : ""}`);
    }

    return hrefs;
}
