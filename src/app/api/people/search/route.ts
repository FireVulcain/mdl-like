import { NextRequest, NextResponse } from "next/server";
import { kuryanaSearch, mdlTitleFromLink } from "@/lib/kuryana";
import { mdlPersonSlug } from "@/lib/person-links";
import { prisma } from "@/lib/prisma";

export type PersonSearchHit = {
    slug: string;
    name: string;
    image: string | null;
    nationality: string | null;
    /** A title the app has them in, when it has one — what tells seven Kim Soo Hyuns apart. */
    knownFor: string | null;
};

type Known = { id: string; shows: number; sample: string };

// MDL people only. The co-star lookup is an intersection of two MDL
// filmographies, so a TMDB person would have nothing to intersect.
export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json([]);
    const result = await kuryanaSearch(q).catch(() => null);
    const raw = (result?.results.people ?? [])
        .map((p) => ({ slug: mdlPersonSlug(p.slug), name: p.name, image: p.thumb || null, nationality: p.nationality || null }))
        .filter((p): p is Omit<PersonSearchHit, "knownFor"> => p.slug !== null)
        .slice(0, 10);

    // MDL returns homonyms in its own order, and a full name can bring seven
    // people with the same name and the same nationality. The ones the app
    // has seen in a cast list come first, most-seen first, and carry a title
    // so the row says which one they are. Matched on the numeric id, as
    // everywhere else — the slug text drifts with romanisation.
    const ids = raw.map((p) => p.slug.match(/^(\d+)-/)?.[1]).filter((id): id is string => !!id);
    const known = new Map<string, Known>();
    if (ids.length > 0) {
        const rows = await prisma
            .$queryRaw<Known[]>`
                with credits as (
                    select c."mdlSlug" as show, substring(p.value->>'slug' from '^/?people/(\\d+)-') as id
                    from "CachedMdlData" c,
                         lateral jsonb_array_elements(coalesce(c."castJson"->'main', '[]'::jsonb)) p(value)
                    union
                    select s."mdlSlug", substring(p.value->>'slug' from '^/?people/(\\d+)-')
                    from "MdlSeasonLink" s,
                         lateral jsonb_array_elements(coalesce(s."castJson"->'main', '[]'::jsonb)) p(value)
                )
                select id, count(distinct show)::int as shows, min(show) as sample
                from credits
                where id = any(${ids})
                group by id
            `
            .catch(() => [] as Known[]);
        for (const row of rows) known.set(row.id, row);
    }

    // The title is there to tell homonyms apart, so it only shows when there
    // are homonyms to tell apart. Under a name that appears once it would be
    // trivia — "Kim Ji Won · Descendants of the Sun" answers a question nobody
    // asked.
    const nameCount = new Map<string, number>();
    for (const p of raw) nameCount.set(p.name, (nameCount.get(p.name) ?? 0) + 1);

    const hits: PersonSearchHit[] = raw
        .map((p) => {
            const k = known.get(p.slug.match(/^(\d+)-/)?.[1] ?? "");
            const ambiguous = (nameCount.get(p.name) ?? 0) > 1;
            return { hit: { ...p, knownFor: ambiguous && k ? mdlTitleFromLink(k.sample) || null : null }, shows: k?.shows ?? 0 };
        })
        .sort((a, b) => b.shows - a.shows)
        .slice(0, 8)
        .map((r) => r.hit);

    return NextResponse.json(hits);
}
