// Continuing a chart instead of writing it again.
//
// A drama still airing gets four more episodes every few weeks. Writing the
// chart from scratch each time reads every old recap again and makes the
// model re-emit all forty links — and, since saveChart replaces the row,
// throws away the stills, the asianwiki pin and every link the admin has
// corrected by hand. A continue run reads only what is new and answers with
// a patch: what to add, what to change, what to end. Everything it does not
// name is kept.
//
// The shapes and the merge live here, with no server imports: the job runs
// them, and a test can run them over a chart on disk.

import type { CharacterMapData, LinkType, MapLink, MapPerson } from "@/lib/character-map";
import type { Recap } from "@/lib/character-map-inputs";
import { linkFrom, draftFrom } from "@/lib/character-map-links";

/* --------------------------------------------------------- the context */

/**
 * One recap, boiled down to what a later run needs to understand a
 * sentence that points back at it ("what he discovered earlier"). Keyed by
 * the recap's URL: `saveRecaps` replaces the whole set on every fetch, so a
 * digest survives a re-read of the same page and simply goes missing for a
 * page that was not there before — which is exactly the recap a run should
 * read in full anyway.
 */
export type EpisodeDigest = { url: string; from: number; to: number; text: string };

export type GenerationContext = { version: 1; digests: EpisodeDigest[]; builtAt: string };

export function readContext(value: unknown): GenerationContext | null {
    const c = value as GenerationContext | null;
    if (!c || c.version !== 1 || !Array.isArray(c.digests)) return null;
    return { version: 1, builtAt: c.builtAt, digests: c.digests.filter((d) => d && typeof d.url === "string" && typeof d.text === "string") };
}

/** The context with these digests folded in, one per URL, newest winning. */
export function withDigests(context: GenerationContext | null, digests: EpisodeDigest[]): GenerationContext {
    const byUrl = new Map((context?.digests ?? []).map((d) => [d.url, d]));
    for (const d of digests) if (d.url && d.text.trim()) byUrl.set(d.url, d);
    return { version: 1, builtAt: new Date().toISOString(), digests: [...byUrl.values()].sort((a, b) => a.from - b.from || a.to - b.to) };
}

/* ------------------------------------------------------------ the plan */

export type RunMode = "full" | "continue" | "nothing";

export type GenerationPlan = {
    mode: RunMode;
    /** the episode ranges the chart says it was read with */
    covered: [number, number][];
    /** the last episode covered, 0 for a chart read without recaps */
    coveredTo: number;
    /** the recaps no covered range holds — what a continue run reads */
    fresh: Recap[];
    /** covered recaps a digest already stands for; the rest are read in full */
    digested: number;
    undigested: Recap[];
    /** one line for the panel, in the admin's words */
    reason: string;
};

/**
 * What a run would do for this entry, worked out before it costs anything.
 *
 * New material is decided by range, never by episode number: a recap of
 * episodes 11-12 is new only when no covered range holds it whole. A chart
 * whose `recaps` block has no `ranges` (an older one) is taken to have read
 * everything up to `episodes`.
 */
export function planRun(map: CharacterMapData | null, recaps: Recap[], context: GenerationContext | null): GenerationPlan {
    const none: [number, number][] = [];
    if (!map) {
        return { mode: "full", covered: none, coveredTo: 0, fresh: recaps, digested: 0, undigested: [], reason: recaps.length ? `No chart yet — ${recaps.length} recaps to read` : "No chart yet" };
    }
    const block = map.recaps;
    if (!block || block.episodes < 1) {
        return {
            mode: "full",
            covered: none,
            coveredTo: 0,
            fresh: recaps,
            digested: 0,
            undigested: [],
            reason: recaps.length ? "This chart was written without the recaps — reading them dates its links, which is a full run" : "This chart was written without recaps",
        };
    }
    const covered: [number, number][] = (block.ranges?.length ? block.ranges : [[1, block.episodes]]).map((r) => [r[0], r[1]] as [number, number]).sort((a, b) => a[0] - b[0]);
    const holds = (r: Recap) => covered.some(([from, to]) => from <= r.fromEp && r.toEp <= to);
    const fresh = recaps.filter((r) => !holds(r)).sort((a, b) => a.fromEp - b.fromEp || a.toEp - b.toEp);
    const old = recaps.filter(holds);
    const digestedUrls = new Set((context?.digests ?? []).map((d) => d.url));
    const undigested = old.filter((r) => !digestedUrls.has(r.url));
    const digested = old.length - undigested.length;

    if (fresh.length === 0) {
        return { mode: "nothing", covered, coveredTo: block.episodes, fresh, digested, undigested, reason: `Nothing new — the chart already reads to episode ${block.episodes}` };
    }
    const from = Math.min(...fresh.map((r) => r.fromEp));
    const to = Math.max(...fresh.map((r) => r.toEp));
    const priming = undigested.length > 0 ? `, and ${undigested.length} older recap${undigested.length === 1 ? "" : "s"} read once to summarise` : "";
    return {
        mode: "continue",
        covered,
        coveredTo: block.episodes,
        fresh,
        digested,
        undigested,
        reason: `Episode${from === to ? ` ${from}` : `s ${from}–${to}`} to add${priming}`,
    };
}

/* ----------------------------------------------------------- the patch */

/** A link the model wants changed, by its number in the list it was shown. */
export type LinkEdit = { link: number; set: Partial<Omit<MapLink, "from" | "to">> & { from?: string; to?: string }; why: string };

export type ChartPatch = {
    addPeople: (Omit<MapPerson, "note" | "alsoPlayedBy" | "still"> & { note: string | null })[];
    addLinks: MapLink[];
    updateLinks: LinkEdit[];
    removeLinks: { link: number; why: string }[];
    addToCompact: string[];
    blocks: { group: string; column: number; row: number }[];
    digests: { url: string; from: number; to: number; text: string }[];
};

export type MergeSummary = { added: number; updated: number; removed: number; people: number };
export type MergeResult = { map: CharacterMapData; warnings: string[]; summary: MergeSummary };

/**
 * How much of a chart one run is allowed to take away. A continue run
 * that wants to drop a third of the links has misunderstood the chart it
 * was given, not found a third of it wrong — the README's own rule is that
 * a tie which changes becomes a second dated link, not a deletion.
 */
export const MAX_REMOVED_SHARE = 0.2;
export const MAX_REMOVED_FLOOR = 3;

/**
 * The chart with the patch folded in. Everything the patch does not name is
 * kept exactly as it was — the people and their stills, the asianwiki pin,
 * the links the admin wrote by hand, the compact layout.
 *
 * Links are addressed by their number in the list the model was shown,
 * which is their index in `map.links`. Throws only for a patch that would
 * gut the chart; everything else doubtful is a warning the job keeps.
 */
export function applyPatch(map: CharacterMapData, patch: ChartPatch, recaps: Recap[]): MergeResult {
    const warnings: string[] = [];
    const ids = new Set(map.people.map((p) => p.id));

    // People first: a link added in the same patch may name one of them.
    const people = [...map.people];
    for (const p of patch.addPeople ?? []) {
        if (!/^[a-z0-9_]+$/.test(p.id)) {
            warnings.push(`new person "${p.id}": not an id, dropped`);
            continue;
        }
        if (ids.has(p.id)) {
            warnings.push(`new person "${p.id}" is already in the chart, kept as it was`);
            continue;
        }
        ids.add(p.id);
        const person: MapPerson = { id: p.id, name: p.name, actor: p.actor, image: p.image, group: p.group, inCast: p.inCast };
        if (p.note) person.note = p.note;
        people.push(person);
    }

    // Changes and removals, both by number, applied to a copy of the list.
    const links: (MapLink | null)[] = [...map.links];
    const inRange = (n: number) => Number.isInteger(n) && n >= 0 && n < map.links.length;
    let updated = 0;
    for (const edit of patch.updateLinks ?? []) {
        if (!inRange(edit.link)) {
            warnings.push(`change to link #${edit.link}: there is no such link, skipped`);
            continue;
        }
        const current = links[edit.link];
        if (!current) continue;
        const draft = draftFrom(current);
        const set = edit.set ?? {};
        if (set.from && !ids.has(set.from)) warnings.push(`change to link #${edit.link}: "${set.from}" is not a person, left alone`);
        else if (set.from) draft.from = set.from;
        if (set.to && !ids.has(set.to)) warnings.push(`change to link #${edit.link}: "${set.to}" is not a person, left alone`);
        else if (set.to) draft.to = set.to;
        if (set.type) draft.type = set.type as LinkType;
        if (set.label != null) draft.label = set.label;
        if (set.short != null) draft.short = set.short;
        if (set.evidence !== undefined) draft.evidence = set.evidence ?? "";
        if (set.source !== undefined) draft.source = set.source ?? "";
        if (set.reveal != null) draft.reveal = set.reveal;
        if (set.inferred != null) draft.inferred = set.inferred;
        if (set.directed != null) draft.directed = set.directed;
        if (set.since !== undefined) draft.since = set.since ?? null;
        if (set.until !== undefined) draft.until = set.until ?? null;
        if (draft.from === draft.to) {
            warnings.push(`change to link #${edit.link} would point it at itself, skipped`);
            continue;
        }
        links[edit.link] = linkFrom(draft, current);
        updated++;
    }

    const removals = (patch.removeLinks ?? []).filter((r) => inRange(r.link));
    const cap = Math.max(MAX_REMOVED_FLOOR, Math.floor(map.links.length * MAX_REMOVED_SHARE));
    if (removals.length > cap) {
        throw new Error(`the run wanted to delete ${removals.length} of ${map.links.length} links (at most ${cap} allowed) — a tie that changes is a second dated link, not a deletion`);
    }
    for (const r of removals) {
        const gone = links[r.link];
        if (gone) warnings.push(`removed ${gone.from} → ${gone.to} (${gone.type}): ${r.why || "no reason given"}`);
        links[r.link] = null;
    }

    const kept = links.filter((l): l is MapLink => l !== null);

    // Additions last, so they read as the newest part of the story.
    let added = 0;
    for (const l of patch.addLinks ?? []) {
        if (!ids.has(l.from) || !ids.has(l.to)) {
            warnings.push(`new link ${l.from} → ${l.to} names somebody who is not in the chart, dropped`);
            continue;
        }
        if (l.from === l.to) {
            warnings.push(`new link ${l.from} → itself, dropped`);
            continue;
        }
        kept.push(linkFrom(draftFrom(l)));
        added++;
    }

    // The compact cut only grows, and only for people the chart now has.
    const compactPeople = [...map.compact.people];
    for (const id of patch.addToCompact ?? []) {
        if (!ids.has(id)) warnings.push(`"${id}" was put in the compact cut but is not a person, skipped`);
        else if (!compactPeople.includes(id)) compactPeople.push(id);
    }
    const blocks = { ...map.compact.blocks };
    for (const b of patch.blocks ?? []) {
        if (b.column >= 0 && b.column <= 2 && b.row >= 0 && b.row <= 2) blocks[b.group] = [b.column, b.row];
    }

    // The recaps block is the server's to write: it knows what was read.
    const ordered = [...recaps].sort((a, b) => a.fromEp - b.fromEp || a.toEp - b.toEp);
    const next: CharacterMapData = {
        ...map,
        people,
        links: kept,
        compact: { ...map.compact, people: compactPeople, blocks },
    };
    if (ordered.length) {
        next.recaps = {
            source: ordered[0].source,
            episodes: Math.max(...ordered.map((r) => r.toEp)),
            count: ordered.length,
            ranges: ordered.map((r) => [r.fromEp, r.toEp] as [number, number]),
        };
    }

    const groups = new Set(next.people.filter((p) => compactPeople.includes(p.id)).map((p) => p.group));
    for (const g of groups) {
        if (g !== "Leads" && !(g in blocks)) warnings.push(`group "${g}" is in the compact cut but has no cell; placed by the layout`);
    }

    return { map: next, warnings, summary: { added, updated, removed: removals.length, people: people.length - map.people.length } };
}
