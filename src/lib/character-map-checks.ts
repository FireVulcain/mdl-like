import { isEvent, type MapLink, type MapPerson } from "@/lib/character-map";
import { foldName } from "@/lib/character-map-stills";

/**
 * The checks a generated chart goes through after the model, in code — free,
 * the same on every run, and aimed at the mistakes a run was seen to make.
 * One of them repairs (a tie written the wrong way round, when a MDL bracket
 * proves it); the rest only warn, and the warnings land in the run's log
 * where the admin fixes them in the editor.
 *
 * Names are compared folded, as the stills are (`foldName`): the recaps
 * write "Un-jeong", "Sang-moo", "Gyeon-un" for MDL's Un Jeong, Sang Mu and
 * Gyeong Un.
 */

// What a recap puts before a surname said alone: "Dr Ha", "Director Choi", "Elder Yun"
const TITLED = /\b(?:dr|doctor|director|elder|mr|mrs|ms|miss|madame|chairman|chairwoman|ceo|president|detective|officer|professor|teacher|captain|chief|manager|lawyer|prosecutor|judge|nurse|general|lord|lady|prince|princess|king|queen|master)\.?\s+([A-Z][a-z]+)/gi;

const bare = (name: string) => name.replace(/["“”]/g, "").replace(/\s*\(.*?\)\s*/g, " ").trim();

/** The folded ways a person is named: the whole name, the given name (Korean order), the first names (Western order), and the surname a title may carry. */
function namesOf(p: MapPerson): { keys: string[]; surnames: string[] } {
    const keys = new Set<string>();
    const surnames = new Set<string>();
    for (const name of p.name.split(" / ").map(bare).filter(Boolean)) {
        const words = name.split(/\s+/);
        keys.add(foldName(name));
        if (words.length >= 2) {
            keys.add(foldName(words.slice(1).join("")));
            keys.add(foldName(words.slice(0, -1).join("")));
            surnames.add(foldName(words[0]));
            surnames.add(foldName(words[words.length - 1]));
        }
    }
    return { keys: [...keys].filter((k) => k.length >= 3), surnames: [...surnames].filter(Boolean) };
}

/** Whether a sentence names the person — by name, by a recap's misspelling of it, or by title and surname. */
export function names(p: MapPerson, sentence: string): boolean {
    const folded = foldName(sentence);
    const { keys, surnames } = namesOf(p);
    // a long name spelt a letter off ("Gyeon-un") still starts the same
    if (keys.some((k) => folded.includes(k) || (k.length >= 6 && folded.includes(k.slice(0, 5))))) return true;
    for (const m of sentence.matchAll(TITLED)) if (surnames.includes(foldName(m[1]))) return true;
    return false;
}

/**
 * The person a "[X's Y]" bracket belongs to — X — or null. The bracket is
 * carried by the one it describes: "[Gyeong Un's wife]" is on the wife's
 * cast line, so Gyeong Un is its X.
 */
function bracketOwner(evidence: string, people: MapPerson[]): { owner: MapPerson; role: string } | null {
    const m = evidence.trim().match(/^\[(.+?)['’]s?\s+([^\]]+)\]$/);
    if (!m) return null;
    const owner = foldName(m[1]);
    const found = people.filter((p) => namesOf(p).keys.includes(owner));
    return found.length === 1 ? { owner: found[0], role: m[2].toLowerCase() } : null;
}

// "his wife" → "wife": the role a short or a bracket names, without its possessive.
// "younger sister" stays whole: "sister" from the older one, with "[Jin I's
// younger sister]" on the younger's line, is right as it is.
const nounOf = (s: string) => s.toLowerCase().replace(/\b(his|her|their|the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();

/**
 * Turns round every directed link read from a "[X's Y]" bracket whose
 * `from` is X and whose short says Y — "his wife" from Gyeong Un, with
 * "[Gyeong Un's wife]", called him her wife; the chart writes `short`
 * under `from`. A short that says the other side of the bracket is right
 * as it is: "mother" from Hyeon U, with "[Hyeon U's son]" on her son's
 * line. Returns the warnings; the links are changed in place.
 */
export function turnBrackets(links: MapLink[], people: MapPerson[]): string[] {
    const warnings: string[] = [];
    for (const l of links) {
        if (!l.directed || !l.evidence) continue;
        const bracket = bracketOwner(l.evidence, people);
        if (!bracket || bracket.owner.id !== l.from) continue;
        const said = nounOf(l.short);
        if (!said || nounOf(bracket.role) !== said) continue;
        warnings.push(`${l.from} → ${l.to} "${l.short}": ${l.evidence} belongs to ${l.from}, so the link goes from ${l.to} — turned round`);
        [l.from, l.to] = [l.to, l.from];
    }
    return warnings;
}

const fromRecap = (l: MapLink) => !!l.evidence && /ep\.?\s*\d/i.test(l.source ?? "");

/**
 * A recap sentence that does not name the people it is quoted for. A tie
 * — what the chart draws — must name both: a line about Un Jeong and Chae
 * Ni once stood behind Un Jeong and Dr Ha. A moment only has to name one:
 * "Un-jeong arrives in time to save her" is how recaps write, while "he
 * gives an interview" says nothing of who. Either the sentence is the
 * wrong one, or the link is.
 */
export function unnamedEnds(links: MapLink[], people: MapPerson[]): string[] {
    const byId = new Map(people.map((p) => [p.id, p]));
    const out: string[] = [];
    for (const l of links) {
        if (!fromRecap(l)) continue;
        const missing = [l.from, l.to].filter((id) => {
            const p = byId.get(id);
            return p && !names(p, l.evidence!);
        });
        if (missing.length === 0 || (isEvent(l) && missing.length < 2)) continue;
        const who = missing.map((id) => byId.get(id)!.name).join(" nor ");
        out.push(`${l.from} → ${l.to} "${l.short}": its sentence does not name ${who} — check it is the right one`);
    }
    return out;
}

// A past act on someone: "saved him", "killed her", "told them"
const PAST_ACT = /^(?:\w+ed|saw|shot|told|met|found|took|gave|left|stole|hit|broke|fought|bit|caught|made|sold|threw|won|lost|chose|drove|forgot|hid|held|kept|led|let|paid|put|ran|sent|struck|swore|taught|tore|woke|wrote)\s+(?:him|her|them|his|their)\b/i;

/** A tie whose short is a past act — "saved him as a child" — reads as a moment; a tie's short is a noun or a state. */
export function pastActTies(links: MapLink[]): string[] {
    return links
        .filter((l) => !isEvent(l) && PAST_ACT.test(l.short.trim()))
        .map((l) => `${l.from} → ${l.to} "${l.short}": a tie whose short is a past act — a moment, or a noun ("his rescuer")`);
}

/** Every warning-only check, over the links given. */
export function linkWarnings(links: MapLink[], people: MapPerson[]): string[] {
    return [...unnamedEnds(links, people), ...pastActTies(links)];
}
