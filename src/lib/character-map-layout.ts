// The compact layout, worked out from the chart instead of asked of the
// model: who sits in the middle, which households the inline row keeps, and
// which cell of the 3×3 grid each group takes. The first pass used to write
// it in the same breath as the story, before it knew who the chart would
// keep; now the chart is read first and the layout follows from it. The
// review pass may still move a group or add a lead nobody declared.
//
// Pure, no server imports: the generator and a hand check both run it.

import { defaultCenter, isEvent, type CharacterMapData } from "@/lib/character-map";

/** The group the leads share — they own the middle cell, never a block. */
export const LEADS_GROUP = "Leads";

/** How many people the compact cut aims for: the leads, their households, whoever the story turns on. */
const COMPACT_TARGET = 14;

// The cells beside the leads, top first — a side column stacks its blocks in
// row order; the bands above and below the leads come last
const LEFT: [number, number][] = [[0, 0], [0, 1], [0, 2]];
const RIGHT: [number, number][] = [[2, 0], [2, 1], [2, 2]];
const MIDDLE: [number, number][] = [[1, 0], [1, 2]];

/**
 * The layout for a chart whose people and links are settled. Groups are
 * ranked by the ties they have with the leads; each goes to the side of the
 * lead it is closer to, whole households into the compact cut until it is
 * about full. A group with no tie to a lead still gets a cell while one is
 * free, and the layout's shorter column takes the rest.
 */
export function defaultCompact(map: Pick<CharacterMapData, "main" | "people" | "links">): CharacterMapData["compact"] {
    const ids = new Set(map.people.map((p) => p.id));
    const ties = map.links.filter((l) => !isEvent(l));
    const degree = (id: string) => ties.filter((l) => l.from === id || l.to === id).length;

    // MDL's main roles — all of them up to four, the first two of an
    // ensemble; a story with one hero pairs them with whoever has the most
    // ties to them
    const center = defaultCenter(map.main.filter((id) => ids.has(id)));
    if (center.length < 2) {
        const pool = map.people.map((p) => p.id).filter((id) => !center.includes(id));
        const near = (id: string) => ties.filter((l) => (center.includes(l.from) && l.to === id) || (center.includes(l.to) && l.from === id)).length;
        pool.sort((a, b) => near(b) - near(a) || degree(b) - degree(a));
        center.push(...pool.slice(0, 2 - center.length));
    }

    const members = new Map<string, string[]>();
    for (const p of map.people) members.set(p.group, [...(members.get(p.group) ?? []), p.id]);
    const tiesTo = (group: string, leads: string[]) => {
        const inGroup = new Set(members.get(group) ?? []);
        return ties.filter((l) => (inGroup.has(l.from) && leads.includes(l.to)) || (inGroup.has(l.to) && leads.includes(l.from))).length;
    };
    // The leads' row, halved: a group goes to the side of the half it is
    // closer to (the page then orders the row to shorten the lines)
    const half = Math.ceil(center.length / 2);
    const leftLeads = center.slice(0, half), rightLeads = center.slice(half);
    const groups = [...members.keys()]
        .filter((g) => g !== LEADS_GROUP)
        .map((g) => ({ group: g, left: tiesTo(g, leftLeads), right: tiesTo(g, rightLeads), size: members.get(g)!.length }))
        // a group that holds a lead is that lead's household, whatever its ties say
        .map((g) => ({ ...g, own: members.get(g.group)!.some((id) => center.includes(id)) }))
        .sort((a, b) => Number(b.own) - Number(a.own) || b.left + b.right - (a.left + a.right) || b.size - a.size);

    const blocks: Record<string, [number, number]> = {};
    const free = { left: [...LEFT], right: [...RIGHT], middle: [...MIDDLE] };
    for (const g of groups) {
        const leftSide = g.own ? members.get(g.group)!.some((id) => leftLeads.includes(id)) : g.left >= g.right;
        const order = leftSide ? [free.left, free.right, free.middle] : [free.right, free.left, free.middle];
        const cell = order.find((cells) => cells.length)?.shift();
        if (cell) blocks[g.group] = cell;
    }

    const people = [...center];
    for (const id of members.get(LEADS_GROUP) ?? []) if (!people.includes(id)) people.push(id);
    for (const g of groups) {
        if (g.left + g.right === 0 && !g.own) continue;
        // whole households only: a group goes in whole, or waits
        if (people.length >= COMPACT_TARGET && !g.own) break;
        for (const id of members.get(g.group)!) if (!people.includes(id)) people.push(id);
    }
    return { people, blocks, center };
}
