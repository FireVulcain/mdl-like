// Pure URL helpers for MDL images, kept out of kuryana.ts so client components
// can import them without pulling in the scraper client and its logging.

/**
 * MDL serves a fixed 300x422 thumbnail whose filename carries a trailing "c"
 * before the extension; dropping it yields the original, 650–900px wide. The
 * scraper only ever reports the thumbnail, which is fine for cast avatars and
 * grid cards but visibly soft once a poster is rendered large.
 *
 * Only rewrites i.mydramalist.com URLs, and leaves the query string alone
 * (it carries MDL's cache-busting ?v=).
 */
export function mdlFullSizeImage(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!/^https?:\/\/i\.mydramalist\.com\//i.test(url)) return url;
    return url.replace(/([A-Za-z0-9_-]+)c(\.(?:jpe?g|png|webp))(\?|$)/i, "$1$2$3");
}

/**
 * The inverse: MDL's 300x422 thumbnail for a stored full-size poster.
 *
 * We store the original so the media page can render it sharp, but MDL images
 * are served `unoptimized` — the browser downloads whatever the URL points at,
 * at any display size. A 900x1300 JPEG behind a 28px watchlist row is ~200KB
 * for nothing.
 *
 * Safe by construction for MDL-sourced posters: the thumbnail is what the
 * scraper handed us in the first place, so it necessarily exists.
 */
export function mdlThumbImage(url: string | null | undefined): string | null {
    if (!url) return null;
    if (!/^https?:\/\/i\.mydramalist\.com\//i.test(url)) return url;
    // Already a thumbnail — leave it alone rather than producing "…cc.jpg"
    if (/[A-Za-z0-9_-]+c(\.(?:jpe?g|png|webp))(\?|$)/i.test(url)) return url;
    return url.replace(/([A-Za-z0-9_-]+)(\.(?:jpe?g|png|webp))(\?|$)/i, "$1c$2$3");
}
