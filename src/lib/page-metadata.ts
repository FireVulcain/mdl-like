import type { Metadata } from "next";
import { fetchTMDB, type TMDBMedia } from "@/lib/tmdb";
import { mdlTitleFromLink } from "@/lib/kuryana";
import { prisma } from "@/lib/prisma";

/**
 * Titles for the browser tab, per page.
 *
 * The root layout carries the "%s · trackr" template, so everything here
 * returns the bare subject — a page that titles itself "X · trackr" would come
 * out as "X · trackr · trackr".
 *
 * Cost: generateMetadata runs as a second pass over the same data the page
 * fetches — and, less obviously, on its own whenever Next prefetches a link to
 * the page. A person page shows thirty-odd works and co-stars, each a link, so
 * opening one ran thirty-odd metadata passes. For TMDB that is a data-cache
 * read. For MDL it was a scrape each (measured 2026-09-29: one person page,
 * ~35 requests to MDL in fifteen seconds), so nothing here scrapes MDL any more:
 * names come from our own rows, and from the slug when there is none.
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

    if (source === "mdl") return mdlBasics(externalId);

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
 * An MDL-native title's name from what we already hold: a watchlist row, then
 * the poster cache (filled by the actor radar and friends), then the slug.
 * "Tears Of The Dragon" from the slug is a fair tab title; a scrape per
 * prefetched link is not a fair price for a better one.
 */
async function mdlBasics(slug: string): Promise<{ title: string; year: string; synopsis: string }> {
    try {
        const [row, poster] = await Promise.all([
            prisma.userMedia.findFirst({ where: { source: "MDL", externalId: slug, title: { not: null } }, select: { title: true, year: true } }),
            prisma.cachedMdlPoster.findUnique({ where: { slug }, select: { title: true } }),
        ]);
        if (row?.title) return { title: row.title, year: row.year ? String(row.year) : "", synopsis: "" };
        if (poster?.title) return { title: poster.title, year: "", synopsis: "" };
    } catch {
        // The slug-derived name below is still a good answer
    }
    return { title: mdlTitleFromLink(slug), year: "", synopsis: "" };
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
 * An MDL person's name from the DB cache however old, else from the slug —
 * never from a scrape. Also what /people/together titles itself with: every
 * "worked with" card links there, so its metadata runs once per card.
 */
export async function mdlPersonName(slug: string): Promise<string> {
    let name = mdlTitleFromLink(slug);
    try {
        const cached = await prisma.cachedKuryanaPerson.findUnique({ where: { slug }, select: { dataJson: true } });
        const cachedName = (cached?.dataJson as { name?: unknown } | null)?.name;
        if (typeof cachedName === "string" && cachedName) name = cachedName;
    } catch {
        // The slug-derived name is already a good answer
    }
    return name;
}

/**
 * An MDL person's page title.
 *
 * Deliberately not kuryanaGetPerson: that one is fetched with revalidate 0, so
 * calling it here would mean a second live scrape for every page view. The DB
 * cache answers instantly, and the slug carries the name anyway when it misses.
 */
export async function mdlPersonMetadata(slug: string, section?: string): Promise<Metadata> {
    const name = await mdlPersonName(slug);
    if (!name) return { title: section ?? "Person" };
    return { title: section ? `${section} · ${name}` : name };
}
