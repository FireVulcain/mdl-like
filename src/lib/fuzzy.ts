// Fuzzy title matching, used by the history search.
//
// Kept dependency-free and deliberately small: the only thing it ever runs
// against is the set of distinct titles one user has logged — a few hundred
// strings — so there is nothing to gain from an index-building library.
//
// Three tiers, in order of confidence:
//   1. the query appears verbatim in the title ("genius" → "Genius Girlfriend")
//   2. the query's characters appear in order, with gaps ("gengirl" → the same)
//   3. the query appears with a letter or two wrong ("genuis" → the same)
//
// Tier 2 is what makes half-remembered titles work, and also what makes short
// queries useless — "a" is a subsequence of nearly every title — so queries
// under three characters are held to tier 1.
//
// Tier 2 only forgives letters that were left out. It cannot forgive one that
// was added or mistyped, because every character of the query still has to be
// found, in order: "chaamuhui" asks for two a's after "ch" and "Cha Mu Hui"
// only has one, so the walk fails and the whole match is lost over a stutter on
// one key. Tier 3 is the answer to that, and it is the expensive one, so it
// only runs once the other two have failed.

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
 * How many wrong letters tier 3 forgives, by query length.
 *
 * Short queries get nothing: at four characters, one free edit reaches a large
 * share of every index, and the query is too small to carry enough signal to
 * pay for it. Longer ones can afford more, because each extra character the
 * query gets right makes an accidental near-match that much less likely.
 */
function allowedEdits(length: number): number {
    if (length < 5) return 0;
    return length < 10 ? 1 : 2;
}

/**
 * Fewest edits turning the query into *any* substring of the target.
 *
 * Ordinary edit distance would compare the query against the whole title and
 * charge for every character it does not cover, so "genuis" against "Genius
 * Girlfriend" would cost the eleven characters it never asked about. The change
 * is one line: the first row starts at zero all the way across, which lets a
 * match begin at any offset for free — the rest is the usual insert/delete/
 * substitute minimum. The best score along the final row is then the closest
 * any substring comes.
 *
 * Bailing out early once every cell in a row exceeds the budget keeps the
 * common case — a query that matches nothing — from paying for the full table.
 */
function substringEditDistance(query: string, target: string, maxEdits: number): number | null {
    const m = query.length;
    const n = target.length;
    if (m === 0) return 0;

    let previous = new Array<number>(n + 1).fill(0);
    let current = new Array<number>(n + 1);

    for (let i = 1; i <= m; i++) {
        current[0] = i; // dropping the query's first i characters
        let rowBest = current[0];

        for (let j = 1; j <= n; j++) {
            const cost = query[i - 1] === target[j - 1] ? 0 : 1;
            const value = Math.min(previous[j - 1] + cost, previous[j] + 1, current[j - 1] + 1);
            current[j] = value;
            if (value < rowBest) rowBest = value;
        }

        // Rows never improve, so once the whole row is over budget it is over.
        if (rowBest > maxEdits) return null;

        const swap = previous;
        previous = current;
        current = swap;
    }

    let best = Infinity;
    for (let j = 0; j <= n; j++) if (previous[j] < best) best = previous[j];
    return best <= maxEdits ? best : null;
}

/** Tier 2 on its own, so a miss can fall through to tier 3 instead of ending the search. */
function subsequenceScore(query: string, target: string): number | null {
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
 * Higher is a better match; null means no match at all.
 *
 * The scale is only meaningful relative to other scores for the same query —
 * the three tiers occupy separate bands, so a verbatim hit always outranks a
 * near-miss and a near-miss always outranks a scattered one, however well
 * either scores inside its own band.
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

    // Tier 2 — every character present, in order.
    const scattered = subsequenceScore(query, target);
    if (scattered !== null) return scattered;

    // Tier 3 — nearly verbatim. Last because it is the only tier that costs a
    // table rather than a scan, and by here the cheap answers are exhausted.
    const budget = allowedEdits(query.length);
    if (budget === 0) return null;

    const distance = substringEditDistance(query, target, budget);
    if (distance === null) return null;

    // Each wrong letter costs more than any ranking detail inside the band, so
    // a one-letter slip always sorts above a two-letter one.
    return 3_000 - distance * 200;
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

/**
 * Above this, the query was found in one piece — exactly, or off by a letter or
 * two. Below it the characters were merely present in order, scattered across
 * the whole string, which is a far weaker claim.
 *
 * Tier 3 lands between 2,600 and 2,800; tier 2 would need bonuses on some
 * eighty characters to reach 2,500, and tier 2 rejects anything that sprawls
 * that far in the first place.
 */
export const ANCHORED_MATCH_FLOOR = 2_500;

export function fuzzyMatches(query: string, target: string): boolean {
    return fuzzyScore(query, target) !== null;
}
