import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { mdlPersonSlug } from "@/lib/person-links";

export type SuggestedPerson = { slug: string; name: string; image: string | null; shows: number };
export type SuggestedPair = { a: SuggestedPerson; b: SuggestedPerson; shared: number };

type PersonRow = { slug: string; name: string; image: string | null; shows: number };
type PairRow = {
    slug_a: string;
    name_a: string;
    image_a: string | null;
    slug_b: string;
    name_b: string;
    image_b: string | null;
    shared: number;
};

// Main cast of every show on the viewer's list, one row per (show, person).
// The same CTE feeds both queries below; $1 is the user id, bound by the caller.
// A string rather than a tagged template because Prisma's cannot splice a
// fragment — hence queryRawUnsafe, with the one variable passed as a parameter.
const CREDITS = `
    select c."tmdbExternalId" as show,
           p.value->>'slug' as slug,
           p.value->>'name' as name,
           p.value->>'profileImage' as image
    from "CachedMdlData" c
    join (select distinct "externalId" from "UserMedia" where "userId" = $1) u
      on u."externalId" = c."tmdbExternalId",
    lateral jsonb_array_elements(coalesce(c."castJson"->'main', '[]'::jsonb)) p(value)
    where p.value->>'slug' is not null and p.value->>'name' is not null
`;

/**
 * The faces that recur across the viewer's own shows — the natural first pick
 * when the page opens with both slots empty. Someone in five of your dramas is
 * someone whose co-stars you would wonder about.
 */
export async function getFrequentPeople(limit = 12): Promise<SuggestedPerson[]> {
    const userId = await getCurrentUserId();
    const rows = await prisma.$queryRawUnsafe<PersonRow[]>(
        `
        with credits as (${CREDITS})
        select slug, min(name) as name, min(image) as image, count(distinct show)::int as shows
        from credits
        group by slug
        having count(distinct show) >= 2
        order by shows desc, min(name)
        limit ${Number(limit)}
    `,
        userId,
    );
    return rows.flatMap((r) => {
        const slug = mdlPersonSlug(r.slug);
        return slug ? [{ slug, name: r.name, image: r.image, shows: r.shows }] : [];
    });
}

/**
 * Pairs who share more than one of the viewer's shows — a comparison already
 * known to have an answer, offered as one click. Ordered by how much they
 * share; ties by name so the list is stable between loads.
 */
export async function getFrequentPairs(limit = 6): Promise<SuggestedPair[]> {
    const userId = await getCurrentUserId();
    const rows = await prisma.$queryRawUnsafe<PairRow[]>(
        `
        with credits as (${CREDITS})
        select x.slug as slug_a, min(x.name) as name_a, min(x.image) as image_a,
               y.slug as slug_b, min(y.name) as name_b, min(y.image) as image_b,
               count(distinct x.show)::int as shared
        from credits x
        join credits y on y.show = x.show and y.slug > x.slug
        group by x.slug, y.slug
        having count(distinct x.show) >= 2
        order by shared desc, min(x.name), min(y.name)
        limit ${Number(limit)}
    `,
        userId,
    );
    return rows.flatMap((r) => {
        const a = mdlPersonSlug(r.slug_a);
        const b = mdlPersonSlug(r.slug_b);
        if (!a || !b) return [];
        return [
            {
                a: { slug: a, name: r.name_a, image: r.image_a, shows: r.shared },
                b: { slug: b, name: r.name_b, image: r.image_b, shows: r.shared },
                shared: r.shared,
            },
        ];
    });
}
