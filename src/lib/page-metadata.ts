import type { Metadata } from "next";
import { mediaService } from "@/services/media.service";
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
 * A media page's title, optionally prefixed for a sub-page: "Cast · Healer".
 *
 * Falls back to the section alone rather than to "Untitled" — a fetch that came
 * back empty is not worth announcing in the tab.
 */
export async function mediaMetadata(id: string, section?: string): Promise<Metadata> {
    const media = await mediaService.getDetails(id).catch(() => null);
    if (!media) return { title: section ?? "Media" };

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
