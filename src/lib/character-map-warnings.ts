/**
 * A run's warnings, sorted for the admin: what the checks already put
 * right, and what is left to look at. They are kept as plain lines on the
 * job row; this reads them back by their endings, which the checks write
 * the same way every time ("— corrected", "— moved to 4", ", dropped"…).
 *
 * A line that names a link ("a → b "short": …") is tied back to it, so the
 * panel can open that link in the relationships editor. No server imports:
 * the generate button reads this.
 */
export type RunWarning = {
    text: string;
    /** the link the line is about, when it names one */
    link: { from: string; to: string; short: string | null } | null;
};

// How a check says it acted: the rest is for the admin to decide
const FIXED = /(— corrected|— moved to \d+|— turned round|— kept .+|, dropped|, skipped|, left alone|kept as it was|added from main|placed by the layout)$/;

const NAMED = /^(?:new (?:link|moment) |link )?([a-z0-9_]+) → ([a-z0-9_]+)(?: "([^"]*)")?/;

function read(text: string): RunWarning {
    const m = text.match(NAMED);
    return { text, link: m ? { from: m[1], to: m[2], short: m[3] ?? null } : null };
}

export function sortWarnings(warnings: string[]): { fixed: RunWarning[]; check: RunWarning[] } {
    const fixed: RunWarning[] = [];
    const check: RunWarning[] = [];
    for (const w of warnings) (FIXED.test(w.trim()) ? fixed : check).push(read(w));
    return { fixed, check };
}

/**
 * The relationships page, opened on one link's editor, from the media page
 * the panel sits on: its path plus /relationships, keeping its ?season=.
 */
export function editLinkHref(mediaPage: { pathname: string; search: string }, link: NonNullable<RunWarning["link"]>): string {
    const q = new URLSearchParams(mediaPage.search);
    q.set("from", link.from);
    q.set("to", link.to);
    if (link.short) q.set("short", link.short);
    return `${mediaPage.pathname.replace(/\/+$/, "")}/relationships?${q}`;
}

/** The link a `from`/`to`/`short` query names, as its index in the chart — the first match, or -1. */
export function findLink(links: { from: string; to: string; short: string }[], from: string, to: string, short: string | null): number {
    const exact = links.findIndex((l) => l.from === from && l.to === to && (short == null || l.short === short));
    if (exact >= 0 || short == null) return exact;
    // the admin may have reworded the short since the run; the pair still finds it
    return links.findIndex((l) => l.from === from && l.to === to);
}
