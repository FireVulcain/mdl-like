/**
 * How long "MDL has no synopsis for this episode" stands before it is asked
 * again. Many dramas never get one — Dive into You had none for any of its
 * twelve — and asking daily re-scraped every one of them each day.
 */
export const EMPTY_SYNOPSIS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether an episode list's air date is still to come; such episodes have nothing to read yet. */
export function isUnaired(airDate: string | null | undefined, now = Date.now()): boolean {
    if (!airDate) return false;
    const t = Date.parse(airDate);
    return Number.isFinite(t) && t > now;
}
