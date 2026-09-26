// How much a chart may say, and where each thing it says goes. The README's
// "Density" rules as numbers the generator, the continue run and a hand
// check all read — pure, no server imports.
//
// Three levels, decided when a link is written:
//   identity — what one would answer to "who is he to her?": family,
//              friends, boss, fan, ex, first love, the couple. A line, in
//              the slider and in the whole story.
//   arc      — a state that changes from stop to stop: the phases of a
//              romance, a passing rivalry, an alliance. A dated line, in the
//              slider only (`wholeStory: false`).
//   detail   — a job, a backstory, a deal, a gesture. Never a line: the
//              person's note, or a moment.
//
// Family ties do not count against one person's budget: a patriarch with a
// wife, two sons and a grandson has five identity ties, all of them lines,
// and the budget was there to catch jobs and deals, not a household.

import { defaultCenter, episodeStops, inWholeStory, isEvent, linkActiveAt, personMetBy, type CharacterMapData, type LinkType, type MapLink } from "@/lib/character-map";

/** Ties holding at once between two people, at any stop of the slider */
export const TIES_PER_PAIR = 2;
/** … between two leads, who carry the story and may carry one more */
export const TIES_PER_LEAD_PAIR = 3;
/** Ties a pair keeps in the whole story: the one that defines it */
export const WHOLE_PER_PAIR = 1;
export const WHOLE_PER_LEAD_PAIR = 2;
/** Whole-story ties drawn on one person who is not a lead */
export const WHOLE_PER_PERSON = 2;
/** Whole-story ties on the whole chart, per person on it */
export const WHOLE_PER_HEAD = 1.3;
/** Ties holding at once on one person who is not a lead, at any stop */
export const TIES_PER_PERSON_AT_STOP = 3;
/** Ties holding at once on the whole chart, per person met by that stop */
export const TIES_PER_HEAD_AT_STOP = 1.3;
/** Moments between two people who are not both leads */
export const MOMENTS_PER_PAIR = 4;
/** Moments on the whole chart, per recap stop: the turns a viewer remembers, not every gesture */
export const MOMENTS_PER_STOP = 2;

const RANK: Record<LinkType, number> = { romance: 0, family: 1, rivalry: 2, friend: 3, bond: 4, work: 5 };

const pairOf = (l: MapLink) => [l.from, l.to].sort().join(" · ");
const leadsOf = (map: CharacterMapData) => new Set(map.compact.center ?? defaultCenter(map.main));
const isLeadPair = (l: MapLink, leads: Set<string>) => leads.has(l.from) && leads.has(l.to);
/** Whether a tie counts against one person's budget — a family tie does not */
const countsForPerson = (l: MapLink) => l.type !== "family";

/**
 * Which of a pair's whole-story ties to keep when there are too many: one a
 * sentence backs before an inferred one, then the longest-standing (open
 * before ended, a long run before a short one), then the stronger kind.
 */
function defining(x: MapLink, y: MapLink): number {
    const span = (l: MapLink) => (l.until == null ? Infinity : l.until - (l.since ?? 0));
    return Number(x.inferred) - Number(y.inferred) || span(y) - span(x) || (x.since ?? 0) - (y.since ?? 0) || RANK[x.type] - RANK[y.type];
}

/**
 * The whole-story marks, settled: at most one tie per pair (two between
 * leads) keeps its place, the rest are written `wholeStory: false`. A pair
 * with none marked stays with none — an arc-only pair is a choice. The key
 * is written only when it says no, and never on a moment. Returns the links
 * and a warning per pair it had to trim.
 */
export function settleWholeStory(map: CharacterMapData): { links: MapLink[]; warnings: string[] } {
    const leads = leadsOf(map);
    const warnings: string[] = [];
    const links = map.links.map((l) => {
        const next = { ...l };
        if (isEvent(next) || inWholeStory(next)) delete next.wholeStory;
        return next;
    });
    const byPair = new Map<string, MapLink[]>();
    for (const l of links) if (!isEvent(l) && inWholeStory(l)) byPair.set(pairOf(l), [...(byPair.get(pairOf(l)) ?? []), l]);
    for (const [pair, ties] of byPair) {
        const max = isLeadPair(ties[0], leads) ? WHOLE_PER_LEAD_PAIR : WHOLE_PER_PAIR;
        if (ties.length <= max) continue;
        const dropped = [...ties].sort(defining).slice(max);
        for (const l of dropped) l.wholeStory = false;
        warnings.push(`${pair}: ${ties.length} ties in the whole story, at most ${max} — kept ${[...ties].sort(defining).slice(0, max).map((l) => `"${l.short}"`).join(", ")}`);
    }
    // Then per person: someone who is not a lead keeps their defining ties
    // in the panorama, family aside. A tie with a lead goes first — the
    // panorama is drawn around the leads — then by the pair's order above.
    const perPerson = new Map<string, MapLink[]>();
    for (const l of links) {
        if (isEvent(l) || !inWholeStory(l) || !countsForPerson(l)) continue;
        for (const id of [l.from, l.to]) if (!leads.has(id)) perPerson.set(id, [...(perPerson.get(id) ?? []), l]);
    }
    for (const [id, ties] of perPerson) {
        const live = ties.filter(inWholeStory);
        if (live.length <= WHOLE_PER_PERSON) continue;
        const withLead = (l: MapLink) => Number(!(leads.has(l.from) || leads.has(l.to)));
        const order = [...live].sort((x, y) => withLead(x) - withLead(y) || defining(x, y));
        for (const l of order.slice(WHOLE_PER_PERSON)) l.wholeStory = false;
        warnings.push(`${id}: ${live.length} ties in the whole story, at most ${WHOLE_PER_PERSON} besides family — kept ${order.slice(0, WHOLE_PER_PERSON).map((l) => `"${l.short}"`).join(", ")}`);
    }
    return { links, warnings };
}

/** What the density rules find wrong with a chart — warnings, never a refusal. */
export function densityWarnings(map: CharacterMapData): string[] {
    const leads = leadsOf(map);
    const out: string[] = [];
    const ties = map.links.filter((l) => !isEvent(l));

    // In the slider: ties holding at once, per pair, at every stop
    const stops = episodeStops(map).map((r) => r[1]);
    const crowded = new Map<string, { at: number; shorts: string[] }>();
    for (const at of stops.length ? stops : [Infinity]) {
        const holding = new Map<string, MapLink[]>();
        for (const l of ties) if (at === Infinity || linkActiveAt(l, at)) holding.set(pairOf(l), [...(holding.get(pairOf(l)) ?? []), l]);
        for (const [pair, list] of holding) {
            const max = isLeadPair(list[0], leads) ? TIES_PER_LEAD_PAIR : TIES_PER_PAIR;
            if (list.length > max && !crowded.has(pair)) crowded.set(pair, { at, shorts: list.map((l) => l.short) });
        }
    }
    for (const [pair, { at, shorts }] of crowded) {
        out.push(`${pair}: ${shorts.length} ties at once${at === Infinity ? "" : ` at episode ${at}`} (${shorts.join(", ")}) — end one with an until, make it a moment, or move it to a note`);
    }

    // … and on one person, and on the whole chart. A support role carrying
    // four ties at every stop is usually a lead nobody declared (put them in
    // compact.center), or a job and a deal that belong in a note.
    if (stops.length) {
        const heavy = new Map<string, { at: number; shorts: string[] }>();
        for (const at of stops) {
            const holding = ties.filter((l) => linkActiveAt(l, at));
            const per = new Map<string, string[]>();
            for (const l of holding) if (countsForPerson(l)) for (const id of [l.from, l.to]) if (!leads.has(id)) per.set(id, [...(per.get(id) ?? []), l.short]);
            for (const [id, shorts] of per) if (shorts.length > TIES_PER_PERSON_AT_STOP && !heavy.has(id)) heavy.set(id, { at, shorts });
            const met = map.people.filter((p) => personMetBy(map.links, p.id, at)).length;
            const cap = Math.ceil(met * TIES_PER_HEAD_AT_STOP);
            if (holding.length > cap) out.push(`episode ${at}: ${holding.length} ties at once for ${met} people — about ${cap} reads; end what is over, and move the arcs of support roles to moments`);
        }
        for (const [id, { at, shorts }] of heavy) {
            out.push(`${id}: ${shorts.length} ties at once from episode ${at} (${shorts.join(", ")}), at most ${TIES_PER_PERSON_AT_STOP} besides family for someone who is not a lead — a lead to put in compact.center, or a job or a deal for the note`);
        }
    }

    // In the whole story: per pair, per person, and on the whole chart
    const whole = ties.filter(inWholeStory);
    const perPair = new Map<string, MapLink[]>();
    for (const l of whole) perPair.set(pairOf(l), [...(perPair.get(pairOf(l)) ?? []), l]);
    for (const [pair, list] of perPair) {
        const max = isLeadPair(list[0], leads) ? WHOLE_PER_LEAD_PAIR : WHOLE_PER_PAIR;
        if (list.length > max) out.push(`${pair}: ${list.length} ties in the whole story, at most ${max}`);
    }
    const perPerson = new Map<string, number>();
    for (const l of whole) if (countsForPerson(l)) for (const id of [l.from, l.to]) perPerson.set(id, (perPerson.get(id) ?? 0) + 1);
    for (const [id, n] of perPerson) {
        if (!leads.has(id) && n > WHOLE_PER_PERSON) out.push(`${id}: ${n} ties in the whole story, at most ${WHOLE_PER_PERSON} besides family for someone who is not a lead`);
    }
    const cap = Math.ceil(map.people.length * WHOLE_PER_HEAD);
    if (whole.length > cap) out.push(`${whole.length} ties in the whole story for ${map.people.length} people — about ${cap} reads; mark the arcs wholeStory false`);

    // A tie of one episode is a moment in all but name — unless it was
    // written as an arc on purpose, one state per episode, kept out of the
    // whole story (W's leads, read episode by episode)
    for (const l of ties) if (l.since != null && l.until === l.since && inWholeStory(l)) out.push(`${l.from} → ${l.to} "${l.short}": a tie of one episode — usually a moment`);

    // Kinship does not end: a mother who dies is still his mother, drawn
    // quieter. What ends with a death is a job, a mentorship, a romance.
    for (const l of ties) if (l.type === "family" && l.until != null) out.push(`${l.from} → ${l.to} "${l.short}": a family tie with an until (${l.until}) — kinship does not end; a death or a disowning is a moment`);

    out.push(...momentWarnings(map));
    return out;
}

/**
 * Moments are most of what a run writes, and most of what it is paid for:
 * a pair that is not the leads keeps its few turns, and the chart as a
 * whole about two per recap. The leads' pair is held only by the total —
 * the README lets them share a dozen.
 */
export function momentWarnings(map: CharacterMapData): string[] {
    const leads = leadsOf(map);
    const out: string[] = [];
    const moments = map.links.filter(isEvent);
    const perPair = new Map<string, number>();
    for (const l of moments) if (!isLeadPair(l, leads)) perPair.set(pairOf(l), (perPair.get(pairOf(l)) ?? 0) + 1);
    for (const [pair, n] of perPair) if (n > MOMENTS_PER_PAIR) out.push(`${pair}: ${n} moments, at most ${MOMENTS_PER_PAIR} — keep the turns a viewer would remember`);
    const stops = episodeStops(map).length;
    const cap = stops * MOMENTS_PER_STOP;
    if (stops && moments.length > cap) out.push(`${moments.length} moments over ${stops} recap stops — about ${cap} reads; keep the turns, drop the gestures`);
    return out;
}
