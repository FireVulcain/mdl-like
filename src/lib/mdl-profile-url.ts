/**
 * The MDL profile link shown in the header. Stored as a full URL; an empty
 * value means "no link", and the header drops the item entirely.
 *
 * Accepts what someone is likely to paste: a full profile or dramalist URL, or
 * just their username. Anything pointing outside mydramalist.com is refused —
 * this string ends up in an href.
 */
export function normalizeMdlProfileUrl(raw: string): { url: string | null; error?: string } {
    const input = raw.trim();
    if (!input) return { url: null };

    // Bare username — no scheme, no dots, no slashes
    if (/^[A-Za-z0-9._-]+$/.test(input) && !input.includes(".")) {
        return { url: `https://mydramalist.com/dramalist/${input}` };
    }

    let parsed: URL;
    try {
        parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
    } catch {
        return { url: null, error: "That doesn't look like a link or a username." };
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return { url: null, error: "Only http(s) links are allowed." };
    }
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "mydramalist.com") {
        return { url: null, error: "That link isn't on mydramalist.com." };
    }
    return { url: `https://mydramalist.com${parsed.pathname}${parsed.search}` };
}
