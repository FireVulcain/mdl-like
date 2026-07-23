// Single source of truth for linking to a person page.
//
// Two person pages exist: /people/<slug> (MDL data — works, nationality, MDL
// links) and /cast/<id> (TMDB data — filmography, birth details). MDL wins when
// we know both, so a cast list coming from MDL links consistently to /people
// instead of splitting depending on whether a TMDB name match happened to work.
//
// MDL slugs reach us in two shapes: "/people/2796-name" (from castJson) and
// "people/3014-name" (from search) — normalize both.

export function mdlPersonSlug(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const bare = raw.replace(/^\/?people\//, "").replace(/^\//, "");
    return bare.length > 0 ? bare : null;
}

export function mdlPersonHref(raw: string | null | undefined): string | null {
    const slug = mdlPersonSlug(raw);
    return slug ? `/people/${slug}` : null;
}

export function tmdbPersonHref(id: string | number): string {
    return `/cast/${id}`;
}

/** MDL slug when available, TMDB id otherwise. Null when we have neither. */
export function personHref(opts: { mdlSlug?: string | null; tmdbId?: string | number | null }): string | null {
    return mdlPersonHref(opts.mdlSlug) ?? (opts.tmdbId != null ? tmdbPersonHref(opts.tmdbId) : null);
}
