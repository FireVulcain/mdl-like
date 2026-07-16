import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { kuryanaGetDetails } from "@/lib/kuryana";

// MDL's list pages only carry the english/romanized title — native titles live
// on each drama's detail page. This module caches them permanently (titles
// don't change), filled progressively by background scrapes.

// Slugs currently being scraped (per server instance) — avoids duplicate work
// across concurrent renders
const inFlightSlugs = new Set<string>();

/**
 * Cached native titles for the given slugs. The returned map contains every
 * CHECKED slug ("" = detail page had no native title) so callers can tell
 * "known to have none" apart from "never looked up".
 */
export async function getNativeTitles(slugs: string[]): Promise<Map<string, string>> {
    if (slugs.length === 0) return new Map();
    const rows = await prisma.mdlNativeTitle.findMany({ where: { slug: { in: [...new Set(slugs)] } } });
    return new Map(rows.map((r) => [r.slug, r.nativeTitle]));
}

/**
 * Scrape and store native titles for unchecked slugs AFTER the response —
 * bounded and throttled (kuryana scrapes a full MDL page per call). Within a
 * few visits the whole home is covered, then no scrapes happen at all.
 */
/**
 * One-stop lookup used by display surfaces: returns what the cache knows and
 * schedules background scrapes for the slugs it doesn't.
 */
export async function getNativeTitlesAndBackfill(slugs: string[]): Promise<Map<string, string>> {
    const titles = await getNativeTitles(slugs);
    prefillNativeTitles(slugs.filter((s) => !titles.has(s)));
    return titles;
}

export function prefillNativeTitles(slugs: string[], limit = 5) {
    const toFetch = [...new Set(slugs)].filter((s) => !inFlightSlugs.has(s)).slice(0, limit);
    if (toFetch.length === 0) return;

    toFetch.forEach((s) => inFlightSlugs.add(s));
    after(async () => {
        try {
            for (const slug of toFetch) {
                try {
                    const details = await kuryanaGetDetails(slug);
                    if (!details?.data) continue; // scrape failed — retry on a later visit
                    // Native title is the first segment of sub_title: "환혼 ‧ Drama ‧ 2022"
                    const nativeTitle = details.data.sub_title?.split("‧")[0]?.trim() ?? "";
                    await prisma.mdlNativeTitle.upsert({
                        where: { slug },
                        create: { slug, nativeTitle },
                        update: { nativeTitle },
                    });
                } catch {
                    // best effort — next visit retries
                }
                await new Promise((r) => setTimeout(r, 200));
            }
        } finally {
            toFetch.forEach((s) => inFlightSlugs.delete(s));
        }
    });
}
