/**
 * Links to an MDL member's list, kept inside the app.
 *
 * Comments and reviews both surface other members, and both used to lead off
 * the site — a review's byline straight to mydramalist.com, a comment's to
 * nowhere at all. They now land on /mdl/<user>, which renders the same list.
 */

/**
 * `user` is MDL's own identifier: a username for most accounts, a bare numeric
 * id for the rest. The dramalist endpoint accepts either.
 *
 * The display name rides along in the query string because the scrape carries
 * no name of its own, so the page would otherwise open on a number. It is a
 * convenience, not a dependency: the URL is complete without it.
 */
export function mdlUserHref(user: string, name?: string | null): string {
    const base = `/mdl/${encodeURIComponent(user)}`;
    return name && name !== user ? `${base}?name=${encodeURIComponent(name)}` : base;
}

/**
 * The member out of an MDL profile URL — "…/profile/jasmineteo" → "jasmineteo".
 *
 * Reviews carry a full profile link rather than a bare id, and the username in
 * it is not always the display name beside it ("Jasmine" reviews as
 * "jasmineteo"), so the link has to be read rather than guessed from the name.
 */
export function mdlUserFromProfileUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const match = url.match(/mydramalist\.com\/(?:profile|dramalist)\/([^/?#]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
}
