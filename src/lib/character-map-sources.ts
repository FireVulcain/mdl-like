import type { MapLink } from "@/lib/character-map";
import type { Recap } from "@/lib/character-map-inputs";

/**
 * A link's sentence, found back in the recaps it was read from. The model
 * quotes the sentence and names the recap — and once named the wrong one:
 * "dramabeans ep. 7" over a sentence from episode 10, with since: 7, so a
 * reader at episode 7 saw an alliance three episodes before it was made.
 * The sentence itself does not lie: it sits in exactly one recap, and that
 * recap says where the link belongs.
 */

const fold = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * The recap that carries the sentence, or null. The quote is matched piece
 * by piece — split where the model broke it with "..." and at sentence
 * ends, since a recap's aside ("Crud.") may sit between two of its
 * sentences — and each piece by its whole, then by its core, the model
 * having tidied an edge now and then ("he was sick" quoted as "He's sick").
 * `undefined` when the quote is too short to be looked for at all.
 */
export function recapOf(evidence: string, recaps: Recap[]): Recap | null | undefined {
    const pieces = evidence
        .split(/\.{3}|…|(?<=[.!?])\s+/)
        .map(fold)
        .filter((p) => p.length >= 24);
    if (pieces.length === 0) return undefined;
    const folded = recaps.map((r) => ({ r, text: fold(r.text) }));
    const has = (text: string, p: string) => text.includes(p) || (p.length >= 44 && text.includes(p.slice(10, -10)));
    const hits = folded.filter(({ text }) => pieces.every((p) => has(text, p)));
    if (hits.length === 1) return hits[0].r;
    if (hits.length === 0) {
        const longest = pieces.reduce((a, b) => (b.length > a.length ? b : a));
        const some = folded.filter(({ text }) => has(text, longest));
        return some.length === 1 ? some[0].r : null;
    }
    return null;
}

const cites = (source: string | null | undefined, r: Recap) => {
    const m = (source ?? "").match(/ep\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
    if (!m) return false;
    const lo = +m[1], hi = m[2] ? +m[2] : lo;
    return lo === r.fromEp && hi === r.toEp;
};

const label = (r: Recap) => `${r.source} ep. ${r.fromEp === r.toEp ? r.fromEp : `${r.fromEp}-${r.toEp}`}`;

/**
 * Every link's source and date held against the recap its sentence is in.
 * A source that names another recap is corrected. A link dated before the
 * recap its sentence is in is moved to it — a reveal always (the README's
 * rule, which the model breaks by dating a twist by the episode it is
 * about), any other link unless its since is 1: a standing tie from the
 * start (a mother, a job, "his mentor" read in episode 4) is left as it
 * is, since a sentence can describe what was always there. Returns the links as they should be, and a
 * warning for each correction, so the run's summary says what moved.
 */
export function checkSources(links: MapLink[], recaps: Recap[]): { links: MapLink[]; warnings: string[] } {
    if (recaps.length === 0) return { links, warnings: [] };
    const warnings: string[] = [];
    let unfound = 0;
    const out = links.map((l) => {
        if (!l.evidence || !/ep\.?\s*\d/i.test(l.source ?? "")) return l;
        const r = recapOf(l.evidence, recaps);
        if (r === undefined) return l;
        if (!r) {
            unfound++;
            return l;
        }
        const fixed = { ...l };
        if (!cites(l.source, r)) {
            warnings.push(`${l.from} → ${l.to} "${l.short}": source said ${l.source}, the sentence is in ${label(r)} — corrected`);
            fixed.source = label(r);
        }
        // A since of 1 says "from the start" — a mother, a job, read from the
        // cast and described later. Any other since was chosen for a reason,
        // and the only reason on record is this sentence: the link happens
        // when it does. A reveal moves whatever its since.
        if (l.since != null && l.since < r.fromEp && (l.reveal || l.since > 1)) {
            warnings.push(`${l.from} → ${l.to} "${l.short}": dated ${l.since}, its sentence is in ${label(r)} — moved to ${r.fromEp}`);
            fixed.since = r.fromEp;
            if (fixed.until != null && fixed.until < fixed.since) fixed.until = fixed.since;
        }
        return fixed;
    });
    if (unfound) warnings.push(`${unfound} link${unfound === 1 ? "" : "s"} quote a sentence no recap carries — paraphrased, or from another source; their dates are the model's word`);
    return { links: out, warnings };
}
