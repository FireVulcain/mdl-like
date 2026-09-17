import { prisma } from "@/lib/prisma";
import { mdlPersonSlug } from "@/lib/person-links";

export type CoStar = { slug: string; name: string; image: string | null; shared: number };

type Raw = { slug: string; name: string; image: string | null; shared: number };

/**
 * People who share a main-cast credit with this person, from the titles the
 * MDL cache already holds.
 *
 * Not a "most frequent co-stars" ranking, and the callers must not present it
 * as one: the cache covers the titles someone on this app has opened, which for
 * a prolific actor is a tenth of the filmography (8 of IU's 80 works when this
 * was written). What it is good for is a set of real, relevant faces to offer
 * as one-click starts for the co-star lookup — the pair page then does the
 * full comparison from both complete filmographies.
 *
 * Matched on MDL's numeric person id: the slug text after it drifts with
 * romanisation ("suzy" vs "bae-suzy") and the cache holds whichever spelling
 * MDL served that day.
 */
export async function getCachedCoStars(personSlug: string, limit = 6): Promise<CoStar[]> {
    const id = personSlug.match(/^(\d+)-/)?.[1];
    if (!id) return [];

    // Both cache tables carry a castJson; a season link is a separate MDL entry
    // with its own cast. UNION dedupes a title cached in both.
    const rows = await prisma.$queryRaw<Raw[]>`
        with credits as (
            select c."mdlSlug" as show, p.value->>'slug' as slug, p.value->>'name' as name, p.value->>'profileImage' as image
            from "CachedMdlData" c,
                 lateral jsonb_array_elements(coalesce(c."castJson"->'main', '[]'::jsonb)) p(value)
            union
            select s."mdlSlug", p.value->>'slug', p.value->>'name', p.value->>'profileImage'
            from "MdlSeasonLink" s,
                 lateral jsonb_array_elements(coalesce(s."castJson"->'main', '[]'::jsonb)) p(value)
        ),
        mine as (select distinct show from credits where slug ~ ${`^/?people/${id}-`})
        select c.slug, min(c.name) as name, min(c.image) as image, count(distinct c.show)::int as shared
        from credits c
        join mine on mine.show = c.show
        where c.slug !~ ${`^/?people/${id}-`} and c.slug is not null and c.name is not null
        group by c.slug
        order by shared desc, min(c.name)
        limit ${limit}
    `;

    return rows.flatMap((row) => {
        const slug = mdlPersonSlug(row.slug);
        return slug ? [{ slug, name: row.name, image: row.image, shared: row.shared }] : [];
    });
}
