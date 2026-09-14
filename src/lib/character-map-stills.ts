import type { CharacterMapData } from "@/lib/character-map";

/**
 * Matching asianwiki's cast table to a chart's people.
 *
 * asianwiki writes "Cho Jung-Seok" where MDL writes "Jo Jung Suk", "Seol
 * In-Ah" for "Seor In A", "Lee Ik-Joon" for "Lee Ik Jun". Same person, two
 * romanisations. Neither side is wrong, so the comparison folds both down to
 * a coarse spelling where those choices stop mattering: voiced and unvoiced
 * consonants together (j/ch, g/k, d/t, b/p), the vowels Korean writes one way
 * and English three (u/oo/eo/eu), r with l, the silent h of "Ah" and "Oh",
 * and no hyphens or spaces.
 *
 * A row matches a person on the actor's name first — an actor is one person,
 * a character name is anyone's guess — and on the character's name only when
 * no actor matched. Pure functions; the DB write lives in the route.
 */
export type StillRow = { actor: string; character?: string; image: string };

export function foldName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .replace(/[^a-z]/g, "")
        .replace(/ch/g, "j")
        .replace(/sh/g, "s")
        .replace(/ck/g, "k")
        // a silent h after a vowel: Ah / A, Oh / O, Ahn / An
        .replace(/([aeiou])h/g, "$1")
        .replace(/woo|wu|oo|eo|eu|ou/g, "u")
        .replace(/ae/g, "e")
        .replace(/ee/g, "i")
        .replace(/ui/g, "i")
        .replace(/oe/g, "we")
        .replace(/z/g, "j")
        .replace(/k/g, "g")
        .replace(/t/g, "d")
        .replace(/p/g, "b")
        .replace(/r/g, "l")
        .replace(/(.)\1+/g, "$1");
}

/**
 * The same fold with the words in alphabetical order: a Japanese actor is
 * "Takenaka Naoto" on MDL and "Naoto Takenaka" on asianwiki.
 */
export function foldNameSorted(name: string): string {
    return foldName(name.replace(/\(.*?\)/g, "").split(/[\s-]+/).filter(Boolean).sort().join(" "));
}

/** A person's name without the alias part or a parenthetical: "Naksu / Cho Yeong" → "Naksu". */
const bare = (name: string) => name.split(" / ")[0].replace(/ \(.*\)$/, "");

export type StillsResult = {
    map: CharacterMapData;
    /** person id → actor name the still came from */
    matched: Record<string, string>;
    /** people no row matched — the chart keeps their headshot */
    unmatched: string[];
    /** rows that matched nobody — guests, or a romanisation the fold misses */
    unused: string[];
};

/**
 * Sets `still` on every person (and every alsoPlayedBy actor) a row matches.
 * Returns a new map; the caller decides where it goes.
 */
export function applyStills(map: CharacterMapData, rows: StillRow[]): StillsResult {
    const byActor = new Map<string, StillRow>();
    const byActorSorted = new Map<string, StillRow>();
    const byCharacter = new Map<string, StillRow>();
    for (const r of rows) {
        if (!r.image) continue;
        const a = foldName(r.actor ?? "");
        if (a && !byActor.has(a)) byActor.set(a, r);
        const as = foldNameSorted(r.actor ?? "");
        if (as && !byActorSorted.has(as)) byActorSorted.set(as, r);
        const c = foldName(r.character ?? "");
        if (c && !byCharacter.has(c)) byCharacter.set(c, r);
    }

    const used = new Set<StillRow>();
    const matched: Record<string, string> = {};
    const unmatched: string[] = [];

    const people = map.people.map((p) => {
        const row = byActor.get(foldName(p.actor)) ?? byActorSorted.get(foldNameSorted(p.actor)) ?? byCharacter.get(foldName(bare(p.name)));
        const alsoPlayedBy = p.alsoPlayedBy?.map((a) => {
            const r = byActor.get(foldName(a.name)) ?? byActorSorted.get(foldNameSorted(a.name));
            if (!r) return a;
            used.add(r);
            return { ...a, still: r.image };
        });
        if (!row) {
            unmatched.push(p.id);
            return alsoPlayedBy ? { ...p, alsoPlayedBy } : p;
        }
        used.add(row);
        matched[p.id] = row.actor;
        return { ...p, still: row.image, ...(alsoPlayedBy ? { alsoPlayedBy } : {}) };
    });

    const unused = rows.filter((r) => r.image && !used.has(r)).map((r) => r.actor);
    return { map: { ...map, people }, matched, unmatched, unused };
}
