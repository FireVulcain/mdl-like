import { prisma } from "@/lib/prisma";

export type WorkLinks = {
    /** numeric MDL id → TMDB external id */
    mdlToTmdb: Map<string, string>;
    /** numeric MDL id → season number, for season links only */
    mdlSeasonMap: Map<string, number>;
    /** numeric MDL id → our cached MDL rating */
    mdlRatingMap: Map<string, number>;
    /** numeric MDL ids that reach TMDB through an alias (Part 1 / Part 2 splits) */
    aliasNumericIds: Set<string>;
};

/**
 * How a set of MDL works reach TMDB, read from the three link tables at once.
 *
 * A slug can be linked three ways — the show-level cache, a season link (S2+),
 * or an alias — and each table is keyed by the full slug while a person page
 * only knows the numeric id, hence the startsWith. Show-level wins where two
 * tables answer for the same id.
 */
export async function resolveWorkLinks(numericIds: string[]): Promise<WorkLinks> {
    const links: WorkLinks = {
        mdlToTmdb: new Map(),
        mdlSeasonMap: new Map(),
        mdlRatingMap: new Map(),
        aliasNumericIds: new Set(),
    };
    if (numericIds.length === 0) return links;

    const byPrefix = { OR: numericIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) };
    const [cached, seasonLinkRows, aliasRows] = await Promise.all([
        prisma.cachedMdlData.findMany({ where: byPrefix, select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true } }),
        prisma.mdlSeasonLink.findMany({ where: byPrefix, select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true, season: true } }),
        prisma.mdlAlias.findMany({ where: byPrefix, select: { mdlSlug: true, tmdbExternalId: true } }),
    ]);

    const { mdlToTmdb, mdlSeasonMap, mdlRatingMap, aliasNumericIds } = links;
    for (const item of cached) {
        const numericId = item.mdlSlug.split("-")[0];
        mdlToTmdb.set(numericId, item.tmdbExternalId);
        if (item.mdlRating != null) mdlRatingMap.set(numericId, item.mdlRating);
    }
    for (const item of seasonLinkRows) {
        const numericId = item.mdlSlug.split("-")[0];
        if (!mdlToTmdb.has(numericId)) mdlToTmdb.set(numericId, item.tmdbExternalId);
        mdlSeasonMap.set(numericId, item.season);
        if (item.mdlRating != null && !mdlRatingMap.has(numericId)) mdlRatingMap.set(numericId, item.mdlRating);
    }
    for (const item of aliasRows) {
        const numericId = item.mdlSlug.split("-")[0];
        if (!mdlToTmdb.has(numericId)) mdlToTmdb.set(numericId, item.tmdbExternalId);
        aliasNumericIds.add(numericId);
        // aliases have no season param — they link directly to the main show page
    }
    return links;
}

/** The internal page for a linked work, or null when it is not linked. */
export function internalHref(links: WorkLinks, numericId: string): string | null {
    const tmdbId = links.mdlToTmdb.get(numericId);
    if (!tmdbId) return null;
    const season = links.mdlSeasonMap.get(numericId);
    return season ? `/media/tmdb-${tmdbId}?season=${season}` : `/media/tmdb-${tmdbId}`;
}
