"use server";

import { kuryanaGetDetails, mdlThumbImage } from "@/lib/kuryana";

export type MdlPreview = {
    title: string;
    /** "19层", when MDL carries one. Shown under the title the way MDL does it. */
    nativeTitle: string | null;
    year: string | null;
    /** "Chinese Drama" — MDL's own phrasing, country and format in one line. */
    kind: string | null;
    poster: string | null;
    rating: number | null;
    /** "#1591", already formatted by MDL. */
    ranked: string | null;
    episodes: string | null;
    synopsis: string | null;
    genres: string[];
};

/** MDL puts the year in parentheses at the end of the title; the popover shows it separately. */
const TRAILING_YEAR = /\s*\((\d{4})\)\s*$/;

/**
 * The card MDL shows when you hover a title on a v1 list, rebuilt from our own
 * scraper.
 *
 * Trimmed hard on purpose. The details response runs to a few kilobytes of cast,
 * tags, reviews and links, and a hover needs none of it — this returns about a
 * tenth of that. The scrape itself is not repeated: kuryanaGetDetails goes
 * through the fetch cache with an hour's revalidation, so the first hover on a
 * title pays for it and every later one, from anyone, is served from memory.
 */
export async function getMdlPreview(slug: string): Promise<MdlPreview | null> {
    const clean = slug.trim();
    if (!clean) return null;

    const result = await kuryanaGetDetails(clean).catch(() => null);
    const d = result?.data;
    if (!d) return null;

    // "종이의 집 ‧ Drama ‧ 2022" — the same three segments the app already reads
    // for native titles elsewhere, taken together here rather than just the first.
    const segments = (d.sub_title ?? "").split("‧").map((s) => s.trim()).filter(Boolean);
    const [nativeTitle, format, subYear] = segments;

    const titleMatch = d.title?.match(TRAILING_YEAR);
    const country = d.details?.country ?? null;
    const type = d.details?.type ?? format ?? null;

    const rating = typeof d.rating === "number" ? d.rating : parseFloat(String(d.rating ?? ""));

    return {
        title: (d.title ?? "").replace(TRAILING_YEAR, "").trim(),
        // Only when it differs from the title — a romanised title repeated
        // underneath itself says nothing.
        nativeTitle: nativeTitle && nativeTitle !== d.title ? nativeTitle : null,
        year: titleMatch?.[1] ?? subYear ?? null,
        kind: [country, type].filter(Boolean).join(" ") || null,
        // The thumbnail variant, not the full-size poster: this renders at 80px
        // and the original is several hundred kilobytes.
        poster: mdlThumbImage(d.poster),
        rating: Number.isFinite(rating) && rating > 0 ? rating : null,
        ranked: d.details?.ranked || null,
        episodes: d.details?.episodes || null,
        synopsis: d.synopsis?.trim() || null,
        genres: (d.others?.genres ?? []).slice(0, 5),
    };
}
