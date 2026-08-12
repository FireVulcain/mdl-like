import type { Metadata } from "next";
import { fetchTMDB, type TMDBMedia } from "@/lib/tmdb";
import { kuryanaGetDetails, mdlTitleFromLink } from "@/lib/kuryana";
import { prisma } from "@/lib/prisma";

/**
 * Titles for the browser tab, per page.
 *
 * The root layout carries the "%s · trackr" template, so everything here
 * returns the bare subject — a page that titles itself "X · trackr" would come
 * out as "X · trackr · trackr".
 *
 * Cost: generateMetadata runs as a second pass over the same data the page
 * fetches. That is free where the source is `fetch` — TMDB and Kuryana both go
 * through Next's data cache with a one-hour revalidate, so the second call is a
 * cache read — and it is why nothing here reaches for a live scrape.
 */

/** Trimmed to something a search result can show without being cut mid-word. */
function summarize(text: string | null | undefined, limit = 160): string | undefined {
    if (!text) return undefined;
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= limit) return clean;
    return `${clean.slice(0, clean.lastIndexOf(" ", limit))}…`;
}

/**
 * Title, year and synopsis, without building the rest.
 *
 * getDetails answers this too, but it also maps credits, recommendations,
 * images, videos and ratings — measured at roughly 60ms of pure CPU to produce
 * one string. The requests here are byte-identical to the ones the page makes,
 * so React's per-request memoization returns the same response object and only
 * the mapping is skipped.
 */
async function mediaBasics(id: string): Promise<{ title: string; year: string; synopsis: string } | null> {
    const dash = id.indexOf("-");
    const source = id.slice(0, dash);
    const externalId = id.slice(dash + 1);

    if (source === "mdl") {
        const details = await kuryanaGetDetails(externalId);
        const d = details?.data;
        return d ? { title: d.title, year: d.year || "", synopsis: "" } : null;
    }

    const params = {
        append_to_response: "credits,recommendations,images,content_ratings,videos",
        include_image_language: "en,null",
    };
    let details: TMDBMedia;
    try {
        details = await fetchTMDB<TMDBMedia>(`/tv/${externalId}`, params);
    } catch {
        details = await fetchTMDB<TMDBMedia>(`/movie/${externalId}`, {
            append_to_response: "credits,recommendations,images,release_dates,videos",
            include_image_language: "en,null",
        });
    }
    return {
        title: details.title || details.name || "",
        year: (details.release_date || details.first_air_date || "").split("-")[0],
        synopsis: details.overview ?? "",
    };
}

/**
 * A media page's title, optionally prefixed for a sub-page: "Cast · Healer".
 *
 * Falls back to the section alone rather than to "Untitled" — a fetch that came
 * back empty is not worth announcing in the tab.
 */
export async function mediaMetadata(id: string, section?: string): Promise<Metadata> {
    const media = await mediaBasics(id).catch(() => null);
    if (!media?.title) return { title: section ?? "Media" };

    // MDL titles arrive with the year already in them ("Our Happy Days (2026)"),
    // TMDB's do not — appending unconditionally gave "… (2026) (2026)".
    const suffix = media.year ? `(${media.year})` : "";
    const name = suffix && !media.title.trimEnd().endsWith(suffix) ? `${media.title} ${suffix}` : media.title;
    return {
        title: section ? `${section} · ${name}` : name,
        description: section ? undefined : summarize(media.synopsis),
    };
}

/**
 * An MDL person's name.
 *
 * Deliberately not kuryanaGetPerson: that one is fetched with revalidate 0, so
 * calling it here would mean a second live scrape for every page view. The DB
 * cache answers instantly, and the slug carries the name anyway when it misses.
 */
export async function mdlPersonMetadata(slug: string, section?: string): Promise<Metadata> {
    let name = mdlTitleFromLink(slug);
    try {
        const cached = await prisma.cachedKuryanaPerson.findUnique({ where: { slug }, select: { dataJson: true } });
        const cachedName = (cached?.dataJson as { name?: unknown } | null)?.name;
        if (typeof cachedName === "string" && cachedName) name = cachedName;
    } catch {
        // The slug-derived name is already a good answer
    }
    if (!name) return { title: section ?? "Person" };
    return { title: section ? `${section} · ${name}` : name };
}
