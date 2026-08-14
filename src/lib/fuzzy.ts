// Fuzzy title matching, used by the history search.
//
// Kept dependency-free and deliberately small: the only thing it ever runs
// against is the set of distinct titles one user has logged — a few hundred
// strings — so there is nothing to gain from an index-building library.
//
// Two tiers, in order of confidence:
//   1. the query appears verbatim in the title ("genius" → "Genius Girlfriend")
//   2. the query's characters appear in order, with gaps ("gengirl" → the same)
//
// Tier 2 is what makes typos and half-remembered titles work, and also what
// makes short queries useless — "a" is a subsequence of nearly every title —
// so queries under three characters are held to tier 1.

const COMBINING_MARKS = /[̀-ͯ]/g;

// Everything outside these ranges collapses to a single space, so "Mr. Queen"
// and "Mr Queen" normalize alike. CJK is kept because most titles here are
// Korean, Chinese or Japanese: kana, CJK ideographs and Hangul syllables.
const NON_SEARCHABLE = /[^a-z0-9぀-ヿ㐀-䶿一-鿿가-힯]+/g;

export function normalizeForSearch(value: string): string {
    // NFD decomposes Hangul syllables into jamo as well as Latin accents, and
    // jamo are not in the kept ranges — without recomposing, every Korean title
    // would normalize to the empty string. NFC puts the syllables back; the
    // accents cannot come back, having just been dropped.
    return value
        .normalize("NFD")
        .replace(COMBINING_MARKS, "")
        .normalize("NFC")
        .toLowerCase()
        .replace(NON_SEARCHABLE, " ")
        .trim();
}

const SUBSEQUENCE_MIN_QUERY = 3;

// A subsequence match is only believable if it stays roughly as long as the
// query. Without this, "gen" happily matches "Godzilla: King of the Monsters"
// by taking one letter from each of three different words — technically a
// subsequence, obviously not what was typed. The allowance covers a couple of
// dropped letters and a word boundary or two.
const SPAN_ALLOWANCE = 8;
const SPAN_FACTOR = 2;

/**
 * Higher is a better match; null means no match at all.
 *
 * The scale is only meaningful relative to other scores for the same query —
 * the two tiers occupy separate bands so a verbatim hit always outranks a
 * scattered one, however well the scattered one scores inside its own band.
 */
export function fuzzyScore(rawQuery: string, rawTarget: string): number | null {
    const query = normalizeForSearch(rawQuery);
    const target = normalizeForSearch(rawTarget);
    if (query.length === 0) return 0;
    if (target.length === 0) return null;

    // Tier 1 — verbatim, ranked by how early it lands and whether it starts a word.
    const at = target.indexOf(query);
    if (at !== -1) {
        const startsWord = at === 0 || target[at - 1] === " ";
        return 10_000 - at + (startsWord ? 500 : 0);
    }

    // Spaces are dropped from the query so "gen girl" still matches across the
    // gap in "genius girlfriend"; they stay in the target because word starts
    // are the strongest signal tier 2 has.
    const chars = query.replace(/ /g, "");
    if (chars.length < SUBSEQUENCE_MIN_QUERY) return null;

    let score = 0;
    let cursor = 0;
    let previous = -2;
    let first = -1;
    let last = -1;

    for (const char of chars) {
        const found = target.indexOf(char, cursor);
        if (found === -1) return null;

        if (found === previous + 1) score += 15; // contiguous run
        if (found === 0 || target[found - 1] === " ") score += 25; // start of a word
        score -= Math.min(found - cursor, 10); // distance skipped to reach it

        if (first === -1) first = found;
        last = found;
        previous = found;
        cursor = found + 1;
    }

    if (last - first + 1 > chars.length * SPAN_FACTOR + SPAN_ALLOWANCE) return null;

    // Shorter titles win ties: matching six characters inside a nine-character
    // title says more than matching them inside a sixty-character one.
    return 1_000 + score - Math.min(target.length, 100) / 10;
}

/**
 * Above this, a score came from tier one — the query appears verbatim.
 *
 * The bands do not overlap: tier one starts at 10,000 and falls by the match's
 * offset, tier two starts at 1,000 and climbs by bonuses that cannot realistically
 * add nine thousand. Anything here or above means the text was found as typed,
 * which is worth knowing when deciding whether a search still needs answering
 * from somewhere else.
 */
export const VERBATIM_MATCH_FLOOR = 5_000;

export function fuzzyMatches(query: string, target: string): boolean {
    return fuzzyScore(query, target) !== null;
}
