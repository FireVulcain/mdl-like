import { mdlThumbImage } from "@/lib/kuryana";

/**
 * The smallest source that still looks sharp in a list thumbnail.
 *
 * Every <Image> here is unoptimized (the free Vercel image quota runs out in a
 * few clicks), so the browser fetches whatever the URL points at, at any
 * display size — the URL *is* the size control.
 *
 * Watchlist thumbnails top out at 56x80 for posters and 96x56 for backdrops.
 * Allowing for a 3x display that's 168px and 288px, so:
 *
 *   TMDB poster    w500  -> w185   99KB -> 22KB
 *   TMDB backdrop  w1280 -> w300
 *   MDL            full  -> the 300x422 thumbnail
 *
 * Which one a TMDB URL is can be read off its own size segment, so callers
 * don't have to say. Anything unrecognised is returned untouched.
 *
 * Only for genuinely small marks: a row's full-width background still wants
 * the large source, however faint it is behind its gradient.
 */
export function listThumbUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^https?:\/\/i\.mydramalist\.com\//i.test(url)) return mdlThumbImage(url);
    return url
        .replace(/(\/t\/p\/)w500(\/)/i, "$1w185$2")
        .replace(/(\/t\/p\/)w1280(\/)/i, "$1w300$2");
}
