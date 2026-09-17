// Types and geometry only — no server imports, since the chart component is
// a client component and pulls this in. The DB read lives in
// character-map-store.ts.

/**
 * A drama's character relationship chart — 인물관계도 — as stored in
 * CharacterMap.dataJson. Read from the MDL cast list and the drama's
 * Wikipedia character section; every link keeps the sentence it came from.
 */
export type LinkType = "family" | "romance" | "rivalry" | "work" | "friend" | "bond";

/**
 * Which stretch of a life an actor covers. MDL tags its own cast that way —
 * "Ha I Chan [Older]", "O Ae Sun [Child]" — so the vocabulary is theirs, and
 * it is what we can count on: an age or a year is only in the sources
 * sometimes, the bracket is always there when a role is cast twice.
 */
export type Era = "child" | "teen" | "young" | "adult" | "middle-aged" | "older";
export const ERA_LABEL: Record<Era, string> = {
    child: "as a child",
    teen: "as a teenager",
    young: "younger",
    adult: "as an adult",
    "middle-aged": "middle-aged",
    older: "older",
};

/** Another actor who plays the same character, at another age. */
export type MapActor = { name: string; image?: string | null; era?: Era; still?: string | null };

export type MapPerson = {
    id: string;
    name: string;
    /** the actor the chart draws — whoever the portrait belongs to */
    actor: string;
    /** the actor's headshot, from MDL's cast list */
    image: string | null;
    /**
     * The character in the show — a still from the drama, from asianwiki.
     * Drawn instead of the headshot when present: a face in costume is the one
     * a reader recognises. Fetched from the reader's own browser (the site
     * blocks servers), so it stays optional and the headshot stays behind it.
     */
    still?: string | null;
    group: string;
    /** the other actors of the same character, if the show casts it twice */
    alsoPlayedBy?: MapActor[];
    /** false for someone the text names but MDL's cast does not carry */
    inCast: boolean;
    note?: string;
};

/** The picture to draw for a person: the still if there is one, else the headshot. */
export function portrait(p: { image: string | null; still?: string | null }): string | null {
    return p.still || p.image;
}

/**
 * The mono line under a face. One other actor fits there and is worth having
 * in the picture — it is half of who plays this person. A list of three does
 * not: it widens the household to say what the panel below says better, so
 * past one the chart keeps the drawn actor alone.
 */
export function actorLine(p: MapPerson): string {
    const others = p.alsoPlayedBy ?? [];
    return others.length === 1 ? `${p.actor} · ${others[0].name}` : p.actor;
}

export type MapLink = {
    from: string;
    to: string;
    type: LinkType;
    /** the full reading, for the detail line */
    label: string;
    /** a word or two, for the chart */
    short: string;
    /** the sentence it was read from, null when inferred */
    evidence: string | null;
    source: string | null;
    /** a twist the story keeps for later — hidden under hideSpoilers */
    reveal: boolean;
    /** no sentence backs it; drawn faded */
    inferred: boolean;
    directed: boolean;
    /**
     * The episode the tie is first seen in, when the chart was read with
     * episode recaps; the "as of episode N" view hides links past N. A link
     * without one — every chart read from the cast and Wikipedia alone — is
     * always shown.
     */
    since?: number | null;
};

export type CharacterMapData = {
    version: 1;
    mdlSlug: string;
    title: string;
    /** the asianwiki page, when its title is not the MDL one ("W - Two Worlds" for "W") */
    asianwiki?: string;
    native?: string;
    year?: number | null;
    /** KR / CN / JP… — the stills run only looks at Korean and Japanese charts */
    country?: string;
    /** the episode recaps the chart was read with, when it was: how far they go */
    recaps?: { source: string; episodes: number; count: number };
    sources: string[];
    /** the leads — drawn in the middle */
    main: string[];
    people: MapPerson[];
    links: MapLink[];
    /** the cut the page draws: which people, and where each household sits on a 3x3 grid */
    compact: { people: string[]; blocks: Record<string, [number, number]>; center?: string[] };
};

/* ------------------------------------------------------------------ layout */

export const PORTRAIT_R = 28;

export type LaidOutPerson = MapPerson & { x: number; y: number; lead: boolean; captions: Caption[] };
export type Caption = { text: string; type: LinkType; reveal: boolean; linkIndex: number };
export type LaidOutLink = MapLink & {
    index: number;
    x1: number; y1: number; x2: number; y2: number;
    /** control point of the quadratic, when several links share a pair */
    cx: number; cy: number;
    /** where its label sits, if it carries one: on the line, which goes under it */
    lx: number; ly: number;
    onLine: boolean;
};
export type Block = { name: string; x: number; y: number; w: number; h: number };
export type Layout = { width: number; height: number; people: LaidOutPerson[]; links: LaidOutLink[]; blocks: Block[] };

export type LayoutOptions = {
    /** the narrowest the chart will be; it grows past this when the households need it */
    width: number;
    /** every person the chart knows, not just the compact cut */
    everyone?: boolean;
    /** link types to draw; all of them when absent */
    types?: Set<LinkType>;
    /** draw links no sentence backs (faded); a reveal answers to hideLink instead */
    inferred?: boolean;
    /** draw people the text names but MDL's cast does not carry */
    ghosts?: boolean;
    /** links to leave out entirely (hidden reveals, say) */
    hideLink?: (l: MapLink) => boolean;
    /** people to leave out entirely, by id (those not yet met, as of an episode) */
    hidePerson?: (id: string) => boolean;
};

/**
 * The chart: the leads in the middle, households in blocks to their left and
 * right, above and below, straight links between them. No simulation — a
 * chart that is read, not explored, and that draws the same way every time.
 * The canvas takes the size the households need; a wide one scrolls.
 *
 * A link between a lead and someone else is not written on the line; it
 * becomes a caption under that someone ("mother · Ae Sun"). Only lead↔lead
 * and outer↔outer links keep a label on the line. That is what keeps the
 * middle of the chart — where a dozen links converge — free of text.
 */
export function layoutCompact(map: CharacterMapData, opts: LayoutOptions): Layout {
    const keep = new Set(opts.everyone ? map.people.map((p) => p.id) : map.compact.people);
    const center = new Set(map.compact.center ?? map.main.slice(0, 2));

    const people: LaidOutPerson[] = map.people
        .filter((p) => keep.has(p.id) && ((opts.ghosts ?? true) || p.inCast) && !(opts.hidePerson?.(p.id) ?? false))
        .map((p) => ({ ...p, x: 0, y: 0, lead: center.has(p.id), captions: [] }));
    const byId = new Map(people.map((p) => [p.id, p]));

    const links = map.links
        .map((l, index) => ({ l, index }))
        .filter(({ l }) => byId.has(l.from) && byId.has(l.to) && !(opts.hideLink?.(l) ?? false))
        .filter(({ l }) => !opts.types || opts.types.has(l.type))
        // A link that is both a reveal and inferred is a reveal first: the
        // spoiler gate decides it alone, or a reader who opened the reveals
        // would still be missing one, and one who opened the inferred links
        // could not see it at all when the reveals had nothing else to count.
        .filter(({ l }) => (opts.inferred ?? false) || !l.inferred || l.reveal);

    // Where each link's words go. Only a link between the two leads keeps a
    // label on its line; every other link is written under a face — under the
    // outer end for a link to a lead, under the `from` end otherwise. Text on
    // a short line lands on whatever face is nearest, and that was the case
    // for every collision left.
    const spoke = (l: MapLink) => center.has(l.from) !== center.has(l.to);
    const onLine = (l: MapLink) => center.has(l.from) && center.has(l.to);
    const firstName = (p: MapPerson) => {
        const words = p.name.split(" / ")[0].replace(/ \(.*\)$/, "").split(" ");
        return (words.length >= 3 ? words.slice(1) : words).join(" ");
    };
    for (const { l, index } of links) {
        if (onLine(l)) continue;
        const a = byId.get(l.from)!, b = byId.get(l.to)!;
        const carrier = spoke(l) ? (center.has(l.from) ? b : a) : a;
        const other = carrier === a ? b : a;
        carrier.captions.push({ text: `${l.short} · ${firstName(other)}`, type: l.type, reveal: l.reveal, linkIndex: index });
    }

    // Households, each sized to what it holds: as many faces across as its
    // count suggests, a pitch wide enough for its widest caption, a line
    // taller for every caption past two. A block is never smaller than its
    // text, which is what let text from one block run into the next.
    const groups = new Map<string, LaidOutPerson[]>();
    for (const p of people) {
        const g = p.lead ? "__center" : p.group;
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(p);
    }
    const textWidth = (p: LaidOutPerson) => Math.max(p.name.length * 6.8, actorLine(p).length * 5.7, ...p.captions.map((c) => c.text.length * 5.9 + 16));
    type Shape = { name: string; members: LaidOutPerson[]; perRow: number; rows: number; dx: number; dy: number; w: number; h: number; x: number; y: number };
    const shapes = new Map<string, Shape>();
    for (const [g, members] of groups) {
        const n = members.length;
        const slot = map.compact.blocks[g];
        const side = g !== "__center" && slot !== undefined && slot[0] !== 1;
        const perRow = g === "__center" ? n : n <= 2 ? (side ? 1 : n) : n === 4 ? 2 : n >= 10 ? 5 : n >= 7 ? 4 : 3;
        const rows = Math.ceil(n / perRow);
        const dx = g === "__center" ? 210 : Math.max(150, Math.max(...members.map(textWidth)) + 16);
        // Room for two chips under every face (the chart's component draws them 22
        // apart), and one more row for each caption past that.
        const dy = 138 + 22 * Math.max(0, Math.max(...members.map((m) => m.captions.length)) - 2);
        shapes.set(g, { name: g, members, perRow, rows, dx, dy, w: perRow * dx + 12, h: rows * dy + 44, x: 0, y: 0 });
    }

    // Four regions around the leads instead of a grid of cells: the left and
    // right columns stack their households, the top and bottom bands lay
    // theirs side by side, and the chart takes whatever size that comes to.
    // A household keeps the side its grid cell pointed at; one with no cell
    // goes to whichever column is shorter.
    const centerShape = shapes.get("__center");
    const region = { left: [] as Shape[], right: [] as Shape[], top: [] as Shape[], bottom: [] as Shape[] };
    const ordered = [...shapes.values()].filter((sh) => sh.name !== "__center").sort((a, b) => {
        const sa = map.compact.blocks[a.name] ?? [9, 9], sb = map.compact.blocks[b.name] ?? [9, 9];
        return sa[1] - sb[1] || sa[0] - sb[0];
    });
    const GAP = 28, PAD = 24;
    const colHeight = (col: Shape[]) => col.reduce((t, sh) => t + sh.h, 0) + Math.max(0, col.length - 1) * GAP;
    for (const sh of ordered) {
        const slot = map.compact.blocks[sh.name];
        if (slot && slot[0] === 0) region.left.push(sh);
        else if (slot && slot[0] === 2) region.right.push(sh);
        else if (slot && slot[1] === 0) region.top.push(sh);
        else if (slot && slot[1] === 2) region.bottom.push(sh);
        else (colHeight(region.left) <= colHeight(region.right) ? region.left : region.right).push(sh);
    }
    const bandWidth = (band: Shape[]) => band.reduce((t, sh) => t + sh.w, 0) + Math.max(0, band.length - 1) * GAP;
    const colWidth = (col: Shape[]) => Math.max(0, ...col.map((sh) => sh.w));
    const bandHeight = (band: Shape[]) => Math.max(0, ...band.map((sh) => sh.h));

    // Three columns, each centred on the canvas's vertical middle: the side
    // columns stack their households; the middle column stacks the top band,
    // the leads and the bottom band, tight against each other — so a tall
    // side column never pushes the bottom band away from the leads.
    const leftW = colWidth(region.left), rightW = colWidth(region.right);
    const centerW = centerShape?.w ?? 0, centerH = centerShape?.h ?? 0;
    const topW = bandWidth(region.top), bottomW = bandWidth(region.bottom);
    const topH = bandHeight(region.top), bottomH = bandHeight(region.bottom);
    const midColW = Math.max(centerW, topW, bottomW);
    const midColH = topH + (topH ? GAP : 0) + centerH + (bottomH ? GAP : 0) + bottomH;
    const leftH = colHeight(region.left), rightH = colHeight(region.right);
    const contentW = leftW + (leftW ? GAP : 0) + midColW + (rightW ? GAP : 0) + rightW;
    const width = Math.max(opts.width, contentW + 2 * PAD);
    const height = Math.round(Math.max(leftH, rightH, midColH, 320) + 2 * PAD);
    const contentLeft = (width - contentW) / 2;

    const placeColumn = (col: Shape[], x0: number, w: number) => {
        let y = (height - colHeight(col)) / 2;
        for (const sh of col) { sh.x = x0 + (w - sh.w) / 2; sh.y = y; y += sh.h + GAP; }
    };
    placeColumn(region.left, contentLeft, leftW);
    placeColumn(region.right, contentLeft + contentW - rightW, rightW);

    const midX = contentLeft + leftW + (leftW ? GAP : 0);
    let y = (height - midColH) / 2;
    let x = midX + (midColW - topW) / 2;
    for (const sh of region.top) { sh.x = x; sh.y = y + (topH - sh.h) / 2; x += sh.w + GAP; }
    y += topH + (topH ? GAP : 0);
    if (centerShape) { centerShape.x = midX + (midColW - centerW) / 2; centerShape.y = y; }
    y += centerH + (bottomH ? GAP : 0);
    x = midX + (midColW - bottomW) / 2;
    for (const sh of region.bottom) { sh.x = x; sh.y = y + (bottomH - sh.h) / 2; x += sh.w + GAP; }

    const blocks: Block[] = [];
    for (const sh of shapes.values()) {
        const { members, perRow, rows, dx, dy } = sh;
        const cx = sh.x + sh.w / 2, cy = sh.y + 16 + (rows * dy) / 2;
        members.forEach((p, i) => {
            const row = Math.floor(i / perRow), col = i % perRow;
            const inRow = Math.min(perRow, members.length - row * perRow);
            p.x = cx + (col - (inRow - 1) / 2) * dx;
            p.y = cy + (row - (rows - 1) / 2) * dy;
        });
        if (sh.name !== "__center") blocks.push({ name: sh.name, x: sh.x, y: sh.y, w: sh.w, h: sh.h });
    }

    // Several links between one pair fan out as arcs.
    const pairCount = new Map<string, number>();
    const pairIdx = new Map<number, number>();
    for (const { l, index } of links) {
        const k = [l.from, l.to].sort().join("|");
        pairIdx.set(index, pairCount.get(k) ?? 0);
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
    }

    // How far above the row a lead↔lead link rises when a third lead sits
    // between its ends: enough for its line and its word to clear that face.
    const OVER = PORTRAIT_R + 28;

    const laid: LaidOutLink[] = links.map(({ l, index }) => {
        const a = byId.get(l.from)!, b = byId.get(l.to)!;
        const k = [l.from, l.to].sort().join("|");
        const n = pairCount.get(k)!, i = pairIdx.get(index)!;
        // Bent as seen from the pair's first face, whichever end the link is
        // written from: measured along each link's own direction, one written
        // A→B and one B→A took the same side and their arcs lay on each other.
        const bend = n > 1 ? (i - (n - 1) / 2) * 34 * (l.from < l.to ? 1 : -1) : 0;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        // Three or more leads sit in one row, so a link between the outer two
        // runs straight through the middle face — and its word lands on it.
        // That one arcs over the row instead. Only leads: the households'
        // faces are never between two ends of a link on a straight line.
        const over = a.lead && b.lead && people.some((p) => p.lead && p !== a && p !== b && Math.abs(p.y - a.y) < 1 && (p.x - a.x) * (p.x - b.x) < 0);
        const cx = (a.x + b.x) / 2 + (-dy / len) * bend * 2;
        const cy = (a.y + b.y) / 2 + (dx / len) * bend * 2 - (over ? OVER * 2 : 0);
        // The word sits at the line's middle: a straight line's midpoint, or an
        // arc's apex — between two faces on the compact chart, that is the one
        // spot with no face under it.
        const lx = (a.x + 2 * cx + b.x) / 4, ly = (a.y + 2 * cy + b.y) / 4;
        return { ...l, index, x1: a.x, y1: a.y, x2: b.x, y2: b.y, cx, cy, lx, ly, onLine: onLine(l) };
    });

    return { width, height, people, links: laid, blocks };
}

export function linkPath(l: LaidOutLink): string {
    const straight = Math.abs(l.cx - (l.x1 + l.x2) / 2) < 0.01 && Math.abs(l.cy - (l.y1 + l.y2) / 2) < 0.01;
    return straight ? `M${l.x1},${l.y1}L${l.x2},${l.y2}` : `M${l.x1},${l.y1}Q${l.cx},${l.cy} ${l.x2},${l.y2}`;
}
