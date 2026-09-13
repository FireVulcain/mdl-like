import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { kuryanaGetPerson, type KuryanaPersonResult, type KuryanaWorkItem } from "@/lib/kuryana";

export type PersonData = KuryanaPersonResult["data"];

// Seven days. A filmography moves slowly, and the person endpoint is one of
// the heavier scrapes.
export const PERSON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rows cached before the scraper started returning a poster per work have none,
 * and would sit that way for the rest of their seven days. Only conclusive when
 * there are works to look at — a person with an empty filmography must not be
 * refetched on every view.
 */
function missingWorkImages(data: PersonData): boolean {
    const works = Object.values(data?.works ?? {}).flat();
    return works.length > 0 && !works.some((work) => work?.title?.image);
}

/**
 * One reader for a person's MDL page, shared by the person page, the actor
 * radar and the co-star lookup. DB first, seven-day TTL; a live scrape only on
 * a miss, and the row is rewritten from it.
 *
 * Outside any component on purpose: reading the clock during render is
 * impure, and the React Compiler's lint says so the moment it can see into a
 * page file.
 */
export async function loadPersonWorks(slug: string): Promise<PersonData | null> {
    const staleAt = new Date(Date.now() - PERSON_CACHE_TTL_MS);
    const cachedRow = await prisma.cachedKuryanaPerson.findUnique({ where: { slug } });
    if (cachedRow && cachedRow.cachedAt > staleAt) {
        const cached = cachedRow.dataJson as PersonData;
        if (!missingWorkImages(cached)) return cached;
    }

    const fetched = await kuryanaGetPerson(slug);
    const data = fetched?.data ?? null;
    if (data) {
        await prisma.cachedKuryanaPerson.upsert({
            where: { slug },
            create: { slug, dataJson: data as unknown as Prisma.InputJsonValue },
            update: { dataJson: data as unknown as Prisma.InputJsonValue, cachedAt: new Date() },
        });
    }
    return data;
}

/** The numeric MDL id a work slug carries: "mdl-687393" → "687393". */
export function extractMdlId(slug: string): string | null {
    const match = slug.match(/^mdl-(\d+)$/);
    return match ? match[1] : null;
}

/** The full MDL slug from a work's link: ".../687393-prisoner-of-beauty" → "687393-prisoner-of-beauty". */
export function extractFullMdlSlug(link: string): string | null {
    const match = link.match(/mydramalist\.com\/(.+)$/);
    return match ? match[1] : null;
}

/**
 * Undated first, then newest to oldest.
 *
 * A work with no year yet is one MDL has not dated because it has not aired —
 * so on a list that already runs newest first, it belongs above this year's,
 * not filed underneath work from twenty years ago. It was sorted last, which
 * read as "old and unknown" rather than "next".
 *
 * The undated test is the same one the card uses to print "TBA", so the two
 * cannot disagree about which works count as undated.
 */
export function sortWorks(works: KuryanaWorkItem[]): KuryanaWorkItem[] {
    const undated = (work: KuryanaWorkItem) => typeof work.year !== "number";
    return [...works].sort((a, b) => {
        if (undated(a) !== undated(b)) return undated(a) ? -1 : 1;
        if (typeof a.year === "number" && typeof b.year === "number") return b.year - a.year;
        return 0;
    });
}
