// The people of a chart, as the editor writes them: the same layer
// character-map-links.ts is for the links. A person read into a draft, a
// draft written back into a person, and the checks between the two — pure,
// so the form and the server action run the same ones.
//
// Mostly for the people MDL's cast does not carry: the villain the webtoon
// never names, the dead mother seen only in flashbacks. The cast import is
// where everyone else comes from, and it is not this.

import type { CharacterMapData, MapPerson } from "@/lib/character-map";

export type PersonDraft = {
    name: string;
    actor: string;
    /** a headshot URL, or empty for the placeholder */
    image: string;
    /** a still from the show, drawn in front of the headshot */
    still: string;
    group: string;
    inCast: boolean;
    note: string;
};

/** The keys the editor owns. `alsoPlayedBy` and anything newer ride along untouched. */
const KNOWN = new Set(["id", "name", "actor", "image", "still", "group", "inCast", "note"]);

export function draftFromPerson(p: MapPerson): PersonDraft {
    return { name: p.name, actor: p.actor ?? "", image: p.image ?? "", still: p.still ?? "", group: p.group, inCast: p.inCast, note: p.note ?? "" };
}

/** Someone new is someone MDL does not list — that is why they are being added by hand. */
export function emptyPersonDraft(): PersonDraft {
    return { name: "", actor: "", image: "", still: "", group: "", inCast: false, note: "" };
}

/**
 * An id for a new person, from their name: the chart's own style — the
 * given name in lower case, no spaces ("Kang Chul" → "kangchul", "the
 * faceless killer" → "facelesskiller") — with a number when it is taken.
 */
export function personId(name: string, map: CharacterMapData): string {
    const words = name
        .split(" / ")[0]
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w && w !== "the");
    const base = words.join("").slice(0, 24) || "person";
    const taken = new Set(map.people.map((p) => p.id));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

/** The draft as a person, in the key order the files are written in. */
export function personFrom(draft: PersonDraft, id: string, original?: MapPerson | null): MapPerson {
    const person: MapPerson = {
        id,
        name: draft.name.trim(),
        actor: draft.actor.trim(),
        image: draft.image.trim() || null,
        group: draft.group.trim(),
        inCast: draft.inCast,
    };
    if (draft.still.trim()) person.still = draft.still.trim();
    if (draft.note.trim()) person.note = draft.note.trim();
    // Written back in the order the files use: id, name, actor, image, still, group…
    const ordered: Record<string, unknown> = {};
    for (const key of ["id", "name", "actor", "image", "still", "group", "inCast", "note"] as const) {
        if (key in person) ordered[key] = person[key];
    }
    for (const [key, value] of Object.entries(original ?? {})) {
        if (!KNOWN.has(key)) ordered[key] = value;
    }
    return ordered as MapPerson;
}

export type PersonErrors = Partial<Record<keyof PersonDraft, string>>;

const isUrl = (s: string) => /^https:\/\/\S+$/.test(s.trim());

export function validatePersonDraft(draft: PersonDraft, map: CharacterMapData, id: string | null): PersonErrors {
    const errors: PersonErrors = {};
    const name = draft.name.trim();
    if (!name) errors.name = "The name the chart writes under the face.";
    else if (map.people.some((p) => p.id !== id && p.name.toLowerCase() === name.toLowerCase())) errors.name = "Someone in this chart already has that name.";
    if (!draft.group.trim()) errors.group = "The household the face is drawn in.";
    if (draft.image.trim() && !isUrl(draft.image)) errors.image = "An https:// link to a picture.";
    if (draft.still.trim() && !isUrl(draft.still)) errors.still = "An https:// link to a picture.";
    return errors;
}

/** Enough of a person to notice the chart changed under the editor. */
export function personFingerprint(p: MapPerson): string {
    return [p.id, p.name, p.group].join("\u0000");
}

/** The chart with one person replaced (same id) or appended. Nothing else is touched. */
export function withPerson(map: CharacterMapData, person: MapPerson): CharacterMapData {
    const at = map.people.findIndex((p) => p.id === person.id);
    const people = at < 0 ? [...map.people, person] : map.people.map((p, i) => (i === at ? person : p));
    return { ...map, people };
}

/** How many links name this person — a person with any cannot be deleted. */
export function linksOf(map: CharacterMapData, id: string): number {
    return map.links.filter((l) => l.from === id || l.to === id).length;
}

/** The chart without this person, and without them in the leads and the compact cut. */
export function withoutPerson(map: CharacterMapData, id: string): CharacterMapData {
    return {
        ...map,
        people: map.people.filter((p) => p.id !== id),
        main: map.main.filter((m) => m !== id),
        compact: {
            ...map.compact,
            people: map.compact.people.filter((m) => m !== id),
            ...(map.compact.center ? { center: map.compact.center.filter((m) => m !== id) } : {}),
        },
    };
}
