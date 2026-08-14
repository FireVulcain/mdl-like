/**
 * Tidy MDL's broadcast range for a narrow details column.
 *
 * MDL writes "Jan 26, 2024 - Mar 23, 2024" — 27 characters, which wrapped onto
 * two lines. When both ends fall in the same year the year is stated once, and
 * MDL's double spaces ("Aug  7") are collapsed.
 *
 * Anything that doesn't parse as a date range is passed through cleaned, so
 * placeholders like "2026 - ?" survive intact.
 */
const MDL_DATE = /^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/;

export function formatAiredRange(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const clean = raw.replace(/\s+/g, " ").trim();

    const parts = clean.split(/\s+-\s+/);
    if (parts.length !== 2) {
        // A single date still gets its spacing normalised
        const one = MDL_DATE.exec(clean);
        return one ? `${one[1]} ${one[2]}, ${one[3]}` : clean;
    }

    const [a, b] = parts.map((p) => MDL_DATE.exec(p.trim()));
    if (!a || !b) return clean;

    const [, aMon, aDay, aYear] = a;
    const [, bMon, bDay, bYear] = b;
    return aYear === bYear
        ? `${aMon} ${aDay} – ${bMon} ${bDay}, ${aYear}`
        : `${aMon} ${aDay}, ${aYear} – ${bMon} ${bDay}, ${bYear}`;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * The day an MDL range ends, or null when it does not say.
 *
 * MDL is the only source that reliably knows an Asian drama has finished —
 * TMDB left Genius Girlfriend on "Returning Series" a day after its last
 * episode, which is what kept a countdown alive for an episode 5 that had aired
 * eleven days earlier.
 *
 * Deliberately narrow. Of the 284 ranges stored, 221 carry two full dates and
 * are the only ones this answers for; "2026 - ?" and "Oct, 2026 - ?" mean still
 * airing, a lone date is a one-off, and both come back null so the caller keeps
 * whatever behaviour it had. Only a date it actually parsed is worth acting on.
 */
export function airedEndDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    const parts = raw.replace(/\s+/g, " ").trim().split(/\s+-\s+/);
    if (parts.length !== 2) return null;

    const end = MDL_DATE.exec(parts[1].trim());
    if (!end) return null; // "?" — still airing, or a shape we do not know

    const month = MONTHS.indexOf(end[1].toLowerCase());
    if (month === -1) return null;

    // End of that day, local: an episode airing on the last day has not finished
    // airing at 00:00 on it.
    return new Date(Number(end[3]), month, Number(end[2]), 23, 59, 59);
}

/** True only when MDL states an end date and it has passed. */
export function hasFinishedAiring(raw: string | null | undefined, now = new Date()): boolean {
    const end = airedEndDate(raw);
    return end !== null && end < now;
}
