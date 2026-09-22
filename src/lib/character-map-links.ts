// The layer between the chart's JSON and the editor's form: a link read into
// a draft, a draft written back into a link, and the checks that stand
// between the two. Pure functions, no server imports — the form runs them on
// every keystroke and the server action runs the same ones before it writes,
// so the browser and the route never disagree about what a valid link is.

import { isEvent, LINK_TYPES, type CharacterMapData, type LinkKind, type LinkType, type MapLink } from "@/lib/character-map";

/**
 * One relationship as the form holds it: the text fields as strings (an
 * empty one becomes null on the way out), the flags as booleans, the
 * episodes as numbers or null.
 */
export type LinkDraft = {
    from: string;
    to: string;
    /** a lasting tie, drawn; or a moment, read in the panel and the list */
    kind: LinkKind;
    type: LinkType;
    label: string;
    short: string;
    evidence: string;
    source: string;
    reveal: boolean;
    inferred: boolean;
    directed: boolean;
    since: number | null;
    until: number | null;
};

/** The keys the editor owns. Anything else a link carries is kept untouched. */
const KNOWN = new Set(["from", "to", "kind", "type", "label", "short", "evidence", "source", "reveal", "inferred", "directed", "since", "until"]);

export function draftFrom(link: MapLink): LinkDraft {
    return {
        from: link.from,
        to: link.to,
        kind: isEvent(link) ? "event" : "tie",
        type: link.type,
        label: link.label ?? "",
        short: link.short ?? "",
        evidence: link.evidence ?? "",
        source: link.source ?? "",
        reveal: !!link.reveal,
        inferred: !!link.inferred,
        directed: !!link.directed,
        since: link.since ?? null,
        until: link.until ?? null,
    };
}

/** A new relationship, with the chart's commonest source already filled in. */
export function emptyDraft(map: CharacterMapData): LinkDraft {
    const counts = new Map<string, number>();
    for (const l of map.links) if (l.source) counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
    const source = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    return { from: "", to: "", kind: "tie", type: "family", label: "", short: "", evidence: "", source, reveal: false, inferred: false, directed: false, since: null, until: null };
}

/**
 * The draft as a link, in the key order the files are written in, with the
 * keys the editor does not know about carried over from the link it came
 * from. `since` and `until` are only written when they say something, or
 * when the original already carried them — a chart read without the recaps
 * keeps its links free of a null episode it never had.
 */
export function linkFrom(draft: LinkDraft, original?: MapLink | null): MapLink {
    const link: MapLink = {
        from: draft.from,
        to: draft.to,
        type: draft.type,
        label: draft.label.trim(),
        short: draft.short.trim(),
        evidence: draft.evidence.trim() || null,
        source: draft.source.trim() || null,
        reveal: draft.reveal,
        inferred: draft.inferred,
        directed: draft.directed,
    };
    // A tie has no kind written — every chart from before the distinction
    // reads that way — and a moment has no until: it is over when it happens.
    if (draft.kind === "event") link.kind = "event";
    if (draft.since != null || (original && "since" in original)) link.since = draft.since;
    if (draft.kind !== "event" && (draft.until != null || (original && "until" in original))) link.until = draft.until;
    for (const [key, value] of Object.entries(original ?? {})) {
        if (!KNOWN.has(key)) (link as unknown as Record<string, unknown>)[key] = value;
    }
    return link;
}

/** What a draft says, per field. An empty object is a link that can be saved. */
export type DraftErrors = Partial<Record<keyof LinkDraft, string>>;

export function validateDraft(draft: LinkDraft, map: CharacterMapData): DraftErrors {
    const errors: DraftErrors = {};
    const ids = new Set(map.people.map((p) => p.id));
    if (!draft.from) errors.from = "Pick a character.";
    else if (!ids.has(draft.from)) errors.from = `"${draft.from}" is not in this chart.`;
    if (!draft.to) errors.to = "Pick a character.";
    else if (!ids.has(draft.to)) errors.to = `"${draft.to}" is not in this chart.`;
    if (draft.from && draft.from === draft.to) errors.to = "A relationship needs two different people.";
    if (!LINK_TYPES.includes(draft.type)) errors.type = "Pick a kind of tie.";
    if (!draft.label.trim()) errors.label = "The full reading — what the chart shows when the link is opened.";
    if (!draft.short.trim()) errors.short = "The one to three words drawn under the face.";
    if (draft.since != null && (!Number.isInteger(draft.since) || draft.since < 1)) errors.since = "An episode number, from 1.";
    if (draft.until != null && (!Number.isInteger(draft.until) || draft.until < 1)) errors.until = "An episode number, from 1.";
    if (draft.since != null && draft.until != null && draft.until < draft.since) errors.until = "The last episode comes before the first.";
    if (draft.kind === "event" && draft.since == null) errors.since = "A moment happens in an episode — say which.";
    return errors;
}

/**
 * What is worth saying but not worth blocking a save over: the two rules the
 * generator keeps as warnings rather than checks.
 */
export function draftWarnings(draft: LinkDraft, map: CharacterMapData): string[] {
    const out: string[] = [];
    if (draft.inferred && draft.evidence.trim()) out.push("Marked inferred, but it carries a sentence — inferred means no sentence backs it.");
    if (!draft.inferred && !draft.evidence.trim()) out.push("No sentence backs this. Either quote one, or mark it inferred so the chart draws it faded.");
    if (draft.kind === "tie" && draft.since != null && draft.until === draft.since) out.push("A tie that holds for one episode is usually a moment — something that happened, not something that lasts. Moments are read in the panel, not drawn.");
    // Only the first episode moves the slider's stops: they are the ends of
    // the recaps' ranges, and one that no recap covers drops the slider back
    // to counting episode by episode. An `until` past them costs nothing.
    const covered = map.recaps?.episodes ?? 0;
    if (covered > 0 && draft.since != null && draft.since > covered) {
        out.push(`No recap covers episode ${draft.since} — the recaps stop at ${covered}, and dating a link past them makes the slider count one episode at a time.`);
    }
    return out;
}

/**
 * Enough of a link to tell it apart from the others at the same index — the
 * editor sends it with every write, so an edit made against a chart that has
 * since been rewritten (a generate run, another tab) is refused instead of
 * landing on whatever link now sits there.
 */
export function fingerprint(link: MapLink): string {
    return [link.from, link.to, link.type, link.label].join("\u0000");
}

/** The chart with one link replaced, or appended when `index` is null. Nothing else is touched. */
export function withLink(map: CharacterMapData, index: number | null, link: MapLink): CharacterMapData {
    const links = index == null ? [...map.links, link] : map.links.map((l, i) => (i === index ? link : l));
    return { ...map, links };
}

/** The chart without the link at `index`. */
export function withoutLink(map: CharacterMapData, index: number): CharacterMapData {
    return { ...map, links: map.links.filter((_, i) => i !== index) };
}
