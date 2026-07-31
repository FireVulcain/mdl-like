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
