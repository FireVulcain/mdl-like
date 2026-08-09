import { prisma } from "@/lib/prisma";
import { mdlPersonHref } from "@/lib/person-links";

// The MDL enrichment the spotlight card shows on top of the list data: genres,
// the first three faces, and the global rank.
export type RowExtras = {
    genres: string[];
    cast: { name: string; profileImage: string | null; href: string | null }[];
    mdlRanking: number | null;
};

type Raw = {
    mdlSlug: string;
    tmdbExternalId: string;
    genres: unknown;
    mdlRanking: number | null;
    cast_top: unknown;
};

// castJson holds the entire cast — 10 KB per show on average, 43 KB at worst —
// and only three names are ever displayed. Slicing it in Postgres rather than
// reading it whole and slicing in JS takes a 40-row lookup from 225ms / 552 KB
// down to 80ms / 23 KB, which is what makes fetching this for a whole row
// affordable at all.
const SELECT = `
    select "mdlSlug", "tmdbExternalId", "genres", "mdlRanking",
           jsonb_path_query_array("castJson", '$.main[0 to 2]') as cast_top
    from "CachedMdlData"
`;

function shape(r: Raw): RowExtras {
    const genres = Array.isArray(r.genres)
        ? (r.genres as unknown[]).filter((g): g is string => typeof g === "string").slice(0, 3)
        : [];
    // The href is resolved here rather than in the browser: castJson stores the
    // slug as "/people/5346-moon-ga-young", and mdlPersonHref already knows the
    // two shapes MDL sends.
    const cast = Array.isArray(r.cast_top)
        ? (r.cast_top as { name?: string; profileImage?: string; slug?: string }[])
              .filter((m) => m?.name)
              .map((m) => ({
                  name: m.name!,
                  profileImage: m.profileImage || null,
                  href: mdlPersonHref(m.slug),
              }))
        : [];
    return { genres, cast, mdlRanking: r.mdlRanking };
}

/**
 * Bulk version of what used to be fetched for the spotlight lead alone. Every
 * card in the row can be promoted to the lead, so every card needs the data —
 * but as three set-based queries, not three per show.
 *
 * The three steps mirror the single-row lookup they replace: MDL slugs drift
 * when a title changes, so a miss is retried through the alias table and then
 * through the numeric id that prefixes every slug.
 */
export async function getRowExtras(slugs: string[]): Promise<Map<string, RowExtras>> {
    const found = new Map<string, RowExtras>();
    const unique = [...new Set(slugs)].filter(Boolean);
    if (unique.length === 0) return found;

    const direct = await prisma.$queryRawUnsafe<Raw[]>(`${SELECT} where "mdlSlug" = any($1)`, unique);
    for (const r of direct) found.set(r.mdlSlug, shape(r));

    const missing = unique.filter((s) => !found.has(s));
    if (missing.length > 0) {
        const aliases = await prisma.mdlAlias.findMany({
            where: { mdlSlug: { in: missing } },
            select: { mdlSlug: true, tmdbExternalId: true },
        });
        if (aliases.length > 0) {
            const rows = await prisma.$queryRawUnsafe<Raw[]>(
                `${SELECT} where "tmdbExternalId" = any($1)`,
                aliases.map((a) => a.tmdbExternalId),
            );
            const byId = new Map(rows.map((r) => [r.tmdbExternalId, r]));
            for (const a of aliases) {
                const r = byId.get(a.tmdbExternalId);
                if (r) found.set(a.mdlSlug, shape(r));
            }
        }
    }

    // Same MDL id, different slug text. The ids come out of a \d+ match, so they
    // are safe to splice into the pattern.
    const stillMissing = unique.filter((s) => !found.has(s));
    const ids = stillMissing.map((s) => s.match(/^(\d+)-/)?.[1]).filter((id): id is string => !!id);
    if (ids.length > 0) {
        const rows = await prisma.$queryRawUnsafe<Raw[]>(
            `${SELECT} where "mdlSlug" ~ $1`,
            `^(${[...new Set(ids)].join("|")})-`,
        );
        for (const r of rows) {
            const id = r.mdlSlug.match(/^(\d+)-/)?.[1];
            const slug = stillMissing.find((s) => s.startsWith(`${id}-`));
            if (slug) found.set(slug, shape(r));
        }
    }

    return found;
}
