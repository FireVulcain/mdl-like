import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData, Era, MapLink, MapPerson } from "@/lib/character-map";
import { countryCode, type ChartInputs } from "@/lib/character-map-inputs";
import type { Prisma } from "@prisma/client";

/**
 * Writes a relationship chart from the gathered inputs, the way the
 * hand-written ones were: the same reading rules, the same shape, one call
 * to Claude with the output held to the chart's JSON schema, then the same
 * checks the scratch generator ran before a file was written.
 *
 * Nothing here is clever about the drama — the rules below are the README's,
 * and the model reads the cast and the articles the way a session did.
 */
export { GENERATOR_MODELS, DEFAULT_GENERATOR_MODEL, type GeneratorModel } from "@/lib/character-map-models";
import { GENERATOR_MODELS, DEFAULT_GENERATOR_MODEL, type GeneratorModel } from "@/lib/character-map-models";

/* ------------------------------------------------------------ the rules */

// The README's reading rules, said to a model. Stable text — it is cached
// across runs, so wording changes cost one cache write, nothing else.
const RULES = `You write character relationship charts (인물관계도) for Korean and Chinese dramas, as JSON in the exact shape given, from the inputs a reader gathered: the MDL cast list with its [bracket] notes, the MDL synopsis, and the character section of the Wikipedia articles found (ko for Korean dramas, zh and en for Chinese ones).

Reading rules — follow them the way a careful reader would:

PEOPLE
- People come from the MDL cast: every Main and Support role, systematically. A Guest role only when it carries a tie: a parent, an ex, a victim, a version of a lead at another age. A guest like "[Taxi driver] (Ep. 4)" or "[Reporter]" never enters.
- An actor playing a lead at another age ("Kim Bok Joo [Young]", "[Child]", "[Teen]") is not a person: it is an alsoPlayedBy entry on the character, with era taken from MDL's bracket (child, teen, young, adult, middle-aged, older).
- Someone the articles name but MDL's cast does not carry enters only when structural (a dead spouse, the parent of the plot); then inCast is false and image is null. Otherwise leave them out.
- On a cast of 40+ support roles, keep those the text ties to someone and drop the "Eunuch 2", "Employee", "Nurse" kind.
- id: a short lowercase ascii slug of the given name (e.g. "aesun", "gwansik", "jiwook"); unique. name: the romanised name as MDL writes it, "/" between aliases ("Ryan Gold / Heo Yun Je"). actor: the actor exactly as MDL writes it. image: the img= URL from the cast line (null when absent). note: one short line only when it says something a caption cannot (a job, a condition, a second role by the same actor).
- group: the household or circle, named the way a broadcaster's chart would ("Ae Sun's family", "Cheum Museum", "The palace"). The two leads use the group "Leads". Six groups or fewer beyond Leads.

LINKS
- Every link keeps the sentence it was read from in evidence, and where in source: "MDL cast" for a [bracket] note (quote the bracket, e.g. "[Ae Sun's mother]"), "MDL synopsis", "ko.wikipedia", "zh.wikipedia", "en.wikipedia". Brackets are the most reliable source of all.
- A link with no sentence behind it is inferred: true, with evidence and source null. Keep these rare — only what any viewer of the show would know — and never invent a fact the inputs contradict.
- When sources disagree, the MDL synopsis wins, then the native-language Wikipedia, then en.wikipedia.
- type: family, romance, rivalry, work (also loyalty, mentors, servants, colleagues), friend, bond (what the story invents: a soul in the wrong body, a ghost and its host, a past life, a fan and an idol).
- directed: false for symmetric ties (married, friends, rivals, siblings); true when the label reads from "from" to "to" ("mother" = from is to's mother; "loves him" = from loves to).
- reveal: true for a twist the story keeps for later — a hidden parent, a true identity, a killer, an affair. When in doubt, mark it.
- label: the full reading, a short phrase. short: one to three words the chart draws under a face ("mother", "first love", "rival", "his secretary") — written, never truncated.
- Give each lead at least three or four links with a sentence behind them when the inputs allow it: the media page shows the leads' closest ties, sourced ones first.
- A tie that only says "is in this block" — his guard, her squad, his assistant, a murdered sibling, a maid — is drawn once at most per person, and never for more than two members of the same block: the block's name already says it. A support role whose only tie would be such a membership, whom no source names for anything else, is left out; the ones the story names (the guard who took the spear, the assistant who became a confidant) stay, with that tie.

EPISODES (only when the inputs carry "=== <site> · Episodes N-M ===" recap sections — the site is dramabeans for Korean dramas, cpophome for Chinese ones)
- The recaps are the richest source of ties and turns: a rescue years earlier, a kidnapping, a betrayal, a change of heart. Read them for links the cast and the articles do not say, and for the sentence behind links they only imply. Their source is "<site> ep. 5-6" — the site as the section heads it, and the range of the recap the sentence is in: "dramabeans ep. 5-6", "cpophome ep. 12".
- since: the first episode a link is seen in, as an integer — the first episode of the recap's range when the recap does not say more ("Episodes 5-6" → 5). A tie that is there from the start (a marriage, a mother) has since 1. A tie the story reveals later (a hidden identity, a killer) has the episode of the reveal, and reveal true. Without recaps, since is null on every link.
- A tie that changes over the run is two links, each with its own since and sentence: "hunts Kingfisher" from 2, "lets Kingfisher die, for friendship" from 14 — never one link that averages them. The first one gets until: 13, the episode before the second takes over.
- until: the last episode a tie still holds. Every link that is replaced, undone or over gets one — the fake marriage ends where the real one starts, "his secretary" ends when she is fired, "forgot her" ends when he remembers, a mentor's tie ends the episode he dies. A moment — a rescue, a slap, a kidnapping resolved next episode, a gift — is since and until the same episode. Only what still holds at the end has no until: a marriage that lasts, a sibling, a love that is not undone, a reveal the ending stands on.
- The chart is read as of an episode, and at the end it draws every link without an until: keep that end view sparse. Between two people, at most two links without an until, and never two of the same type. Twelve links between the leads is right when ten of them end; twelve that all hold is a knot.
- With recaps, prefer links a reader of the show would recognise as its turns; a chart of forty links is fine when the recaps carry them and most of them end.

COMPACT
- compact.people: the cut the compact view shows — the leads, their households, and whoever the story turns on; whole groups, never half of one. A big school class or a village can be left out of the cut and stays in the full view.
- compact.blocks: each group other than Leads gets a cell of a 3x3 grid, [column, row]: [0,0] top-left, [2,0] top-right, [0,2] bottom-left, [2,2] bottom-right, [1,0] top-middle, [1,2] bottom-middle. The leads own [1,1]. Every group that has a person in compact.people must have a cell.
- compact.center: the two leads (or three when MDL lists three co-leads). Always at least two: a story with one hero pairs them with whoever the story turns on — the antagonist, the partner, the love interest.
- main: the ids of MDL's Main roles, leads first.

OUTPUT
- version is always 1. mdlSlug, title, native, year and country are given. sources lists what was read, e.g. ["MDL cast (21 roles, 4 main)", "MDL synopsis", "ko.wikipedia 등장인물"].
- Write everything in English except evidence, which is quoted in the language it was read in.
- Do not write still or asianwiki fields. Do not write a recaps field.`;

/* ---------------------------------------------------------- the schema */

const LINK_TYPES = ["family", "romance", "rivalry", "work", "friend", "bond"];
const ERAS = ["child", "teen", "young", "adult", "middle-aged", "older"];
const nullable = (type: string) => ({ type: [type, "null"] });

export const CHART_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["version", "mdlSlug", "title", "native", "year", "country", "sources", "main", "people", "links", "compact"],
    properties: {
        version: { type: "integer", enum: [1] },
        mdlSlug: { type: "string" },
        title: { type: "string" },
        native: { type: "string" },
        year: nullable("integer"),
        country: { type: "string" },
        sources: { type: "array", items: { type: "string" } },
        main: { type: "array", items: { type: "string" } },
        people: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "name", "actor", "image", "group", "inCast", "note", "alsoPlayedBy"],
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    actor: { type: "string" },
                    image: nullable("string"),
                    group: { type: "string" },
                    inCast: { type: "boolean" },
                    note: nullable("string"),
                    alsoPlayedBy: {
                        type: "array",
                        items: {
                            type: "object",
                            additionalProperties: false,
                            required: ["name", "image", "era"],
                            properties: { name: { type: "string" }, image: nullable("string"), era: { type: "string", enum: ERAS } },
                        },
                    },
                },
            },
        },
        links: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["from", "to", "type", "label", "short", "evidence", "source", "reveal", "inferred", "directed", "since", "until"],
                properties: {
                    from: { type: "string" },
                    to: { type: "string" },
                    type: { type: "string", enum: LINK_TYPES },
                    label: { type: "string" },
                    short: { type: "string" },
                    evidence: nullable("string"),
                    source: nullable("string"),
                    reveal: { type: "boolean" },
                    inferred: { type: "boolean" },
                    directed: { type: "boolean" },
                    since: nullable("integer"),
                    until: nullable("integer"),
                },
            },
        },
        compact: {
            type: "object",
            additionalProperties: false,
            required: ["people", "blocks", "center"],
            properties: {
                people: { type: "array", items: { type: "string" } },
                blocks: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["group", "column", "row"],
                        properties: { group: { type: "string" }, column: { type: "integer", enum: [0, 1, 2] }, row: { type: "integer", enum: [0, 1, 2] } },
                    },
                },
                center: { type: "array", items: { type: "string" } },
            },
        },
    },
} as const;

/** What the model writes: the chart, with blocks as a list (a schema cannot say "any key") and nulls where the chart has absences. */
type Draft = Omit<CharacterMapData, "compact" | "people"> & {
    native: string;
    year: number | null;
    country: string;
    people: (Omit<MapPerson, "note" | "alsoPlayedBy" | "still"> & { note: string | null; alsoPlayedBy: { name: string; image: string | null; era: string }[] })[];
    compact: { people: string[]; blocks: { group: string; column: number; row: number }[]; center: string[] };
};

/* ------------------------------------------------------- the checks */

export type Validation = { map: CharacterMapData; warnings: string[] };

/**
 * The checks the scratch generator ran on every hand-written chart, plus
 * the ones a model needs: ids unique and referenced, every group placed,
 * images taken from the cast and not invented, the leads present. A failed
 * check throws; a doubtful one is a warning the job keeps.
 */
export function validateChart(draft: Draft, inputs: ChartInputs): Validation {
    const warnings: string[] = [];
    const castImages = new Set<string>();
    const castNames = new Set<string>();
    for (const list of Object.values(inputs.cast)) for (const m of list) {
        if (m.profile_image) castImages.add(m.profile_image);
        castNames.add(m.name);
    }

    if (!draft.people.length) throw new Error("no people");
    const ids = new Set<string>();
    for (const p of draft.people) {
        if (!/^[a-z0-9_]+$/.test(p.id)) throw new Error(`bad id "${p.id}"`);
        if (ids.has(p.id)) throw new Error(`duplicate id "${p.id}"`);
        ids.add(p.id);
    }
    for (const l of draft.links) {
        if (!ids.has(l.from) || !ids.has(l.to)) throw new Error(`link ${l.from} → ${l.to} names an unknown person`);
        if (l.from === l.to) throw new Error(`link ${l.from} → itself`);
        if (l.inferred && l.evidence) warnings.push(`link ${l.from} → ${l.to} is inferred but carries evidence`);
        if (!l.inferred && !l.evidence) warnings.push(`link ${l.from} → ${l.to} has no evidence and is not inferred`);
    }
    for (const id of [...draft.main, ...draft.compact.center, ...draft.compact.people]) {
        if (!ids.has(id)) throw new Error(`"${id}" is listed but is not a person`);
    }
    // A story with one hero gets one lead in the centre; the layout wants
    // two, so the next of MDL's main roles (then anyone) joins them — a run
    // is too long to throw away over that.
    if (draft.compact.center.length < 2) {
        const pool = [...draft.main, ...draft.people.map((p) => p.id)].filter((id) => !draft.compact.center.includes(id));
        const added = [...new Set(pool)].slice(0, 2 - draft.compact.center.length);
        draft.compact.center = [...draft.compact.center, ...added];
        warnings.push(`compact.center had ${draft.compact.center.length - added.length} lead${added.length === 1 ? "" : "s"}; ${added.join(", ")} added from main`);
    }
    if (draft.compact.center.length < 2) throw new Error("fewer than two people to put in the centre");

    const blocks: Record<string, [number, number]> = {};
    for (const b of draft.compact.blocks) blocks[b.group] = [b.column, b.row];
    const center = new Set(draft.compact.center);
    const keep = new Set(draft.compact.people);
    for (const p of draft.people) {
        if (center.has(p.id) || !keep.has(p.id)) continue;
        // the layout gives a group without a cell the shorter column; a warning, not a lost run
        if (!(p.group in blocks) && !warnings.some((w) => w.startsWith(`group "${p.group}"`))) warnings.push(`group "${p.group}" is in the compact cut but has no cell; placed by the layout`);
    }

    const people: MapPerson[] = draft.people.map((p) => {
        const person: MapPerson = { id: p.id, name: p.name, actor: p.actor, image: p.image, group: p.group, inCast: p.inCast };
        if (p.image && !castImages.has(p.image)) {
            warnings.push(`${p.name}: image is not from the cast list, dropped`);
            person.image = null;
        }
        if (p.inCast && !castNames.has(p.actor)) warnings.push(`${p.name}: actor "${p.actor}" is not spelled as in the cast list`);
        if (p.alsoPlayedBy.length) {
            person.alsoPlayedBy = p.alsoPlayedBy.map((a) => ({ name: a.name, image: a.image && castImages.has(a.image) ? a.image : null, era: a.era as Era }));
        }
        if (p.note) person.note = p.note;
        return person;
    });
    // since only means something when recaps were read; a model's stray
    // number on a run without them would put an episode on every link
    const withRecaps = inputs.recaps.length > 0;
    const lastEp = withRecaps ? Math.max(...inputs.recaps.map((r) => r.toEp)) : 0;
    const links: MapLink[] = draft.links.map((l) => {
        const since = withRecaps && l.since != null && l.since >= 1 ? Math.min(l.since, lastEp) : null;
        // an until before its since, or past the recaps, is a stray number: the tie holds
        const until = withRecaps && since != null && l.until != null && l.until >= since && l.until <= lastEp ? l.until : null;
        const link: MapLink = { ...l, since };
        if (until != null) link.until = until;
        else delete link.until;
        if (!withRecaps) delete link.since;
        return link;
    });
    // The end view draws every link without an until. A pair the model
    // kept piling open links on is what made a 40-episode chart a knot.
    if (withRecaps) {
        const open = new Map<string, number>();
        for (const l of links) {
            if (l.until != null) continue;
            const key = [l.from, l.to].sort().join(" · ");
            open.set(key, (open.get(key) ?? 0) + 1);
        }
        for (const [pair, n] of open) if (n > 2) warnings.push(`${pair}: ${n} links that never end — the end view draws them all; most should carry an until`);
    }

    const map: CharacterMapData = {
        version: 1,
        mdlSlug: inputs.mdlSlug,
        title: draft.title || inputs.title.replace(/ \(\d{4}\)$/, ""),
        sources: draft.sources,
        main: draft.main,
        people,
        links,
        compact: { people: draft.compact.people, blocks, center: draft.compact.center },
    };
    // the fields the hand-written files carry beside the typed ones
    // The country is MDL's, as a code: the model has written "South Korea",
    // and everything downstream (the stills list, the reading rules) keys on
    // KR / CN / JP.
    Object.assign(map, { native: draft.native || inputs.native, year: draft.year ?? inputs.year, country: countryCode(inputs.country) || draft.country });
    if (withRecaps) {
        map.recaps = { source: inputs.recaps[0].source, episodes: lastEp, count: inputs.recaps.length, ranges: inputs.recaps.map((r) => [r.fromEp, r.toEp]) };
        const undated = links.filter((l) => l.since == null).length;
        if (undated) warnings.push(`${undated} link${undated === 1 ? "" : "s"} without an episode — always shown in the episode view`);
    }
    return { map, warnings };
}

/* ------------------------------------------------------------ the call */

/** What a run that failed after the model answered still cost. */
export class ChartError extends Error {
    constructor(message: string, public usage?: GenerateResult["usage"], public model?: string) {
        super(message);
    }
}

export type GenerateResult = Validation & { usage: { inputTokens: number; outputTokens: number; cacheRead: number }; model: string };

/**
 * One streaming call: the rules as a cached system prompt, the inputs as the
 * message, the schema on the output. `onProgress` hears the output grow, for
 * the line under the button. Throws when the key is missing, when the API
 * fails, or when the chart fails a check.
 */
export async function generateChart(inputs: ChartInputs, model: GeneratorModel = DEFAULT_GENERATOR_MODEL, onProgress?: (step: string) => void): Promise<GenerateResult> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server");
    const client = new Anthropic();

    const user = `Write the chart for this entry.\n\nmdlSlug: ${inputs.mdlSlug}\ncountry code: ${countryCode(inputs.country)}\n\n${inputs.text}`;
    let chars = 0;
    const stream = client.messages.stream({
        model: GENERATOR_MODELS[model].id,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema: CHART_SCHEMA } },
        system: [{ type: "text", text: RULES, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
    });
    // The model thinks first — minutes, on a long input with the recaps —
    // and the line under the button counts them off, or the run looks stuck.
    // By the clock, not by thinking deltas: a run showed none of those.
    const began = Date.now();
    const clock = () => {
        const s = Math.round((Date.now() - began) / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    const thinking = setInterval(() => onProgress?.(`Thinking it over… ${clock()}`), 10_000);
    stream.on("text", (delta) => {
        if (chars === 0) clearInterval(thinking);
        chars += delta.length;
        if (onProgress && chars % 2000 < delta.length) onProgress(`Writing the chart… ${Math.round(chars / 1000)}K characters`);
    });
    let message: Anthropic.Message;
    try {
        message = await stream.finalMessage();
    } finally {
        clearInterval(thinking);
    }
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 };
    const fail = (why: string) => new ChartError(why, usage, message.model);
    if (message.stop_reason === "refusal") throw fail(`the model declined: ${message.stop_details?.explanation ?? "refusal"}`);
    if (message.stop_reason === "max_tokens") throw fail("the chart did not fit in the output limit");
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let draft: Draft;
    try {
        draft = JSON.parse(text) as Draft;
    } catch {
        throw fail("the model's output was not JSON");
    }
    onProgress?.("Checking the chart");
    try {
        const { map, warnings } = validateChart(draft, inputs);
        return { map, warnings, model: message.model, usage };
    } catch (e) {
        throw fail(e instanceof Error ? e.message : String(e));
    }
}

/* ------------------------------------------------------------ the save */

/**
 * The row the pages read, and the file the seed script reads — written when
 * the charts folder is there and writable, which it is on the server as in
 * development. The file keeps the repo the source of truth; commit it.
 */
export async function saveChart(
    map: CharacterMapData,
    source: string,
    /**
     * `context` replaces the digests kept for a later continue run;
     * `editedAt` is passed as null by a full run, which throws every
     * hand-written link away and so has nothing left to warn about.
     */
    extra?: { context?: Prisma.InputJsonValue; editedAt?: Date | null },
): Promise<{ file: string | null }> {
    const dataJson = map as unknown as Prisma.InputJsonValue;
    const rest = {
        ...(extra?.context !== undefined ? { contextJson: extra.context } : {}),
        ...(extra?.editedAt !== undefined ? { editedAt: extra.editedAt } : {}),
    };
    await prisma.characterMap.upsert({
        where: { mdlSlug: map.mdlSlug },
        create: { mdlSlug: map.mdlSlug, dataJson, source, ...rest },
        update: { dataJson, source, ...rest },
    });
    const dir = path.join(process.cwd(), "prisma", "character-maps");
    let file: string | null = null;
    try {
        if (fs.existsSync(dir)) {
            file = path.join(dir, `${map.mdlSlug}.json`);
            fs.writeFileSync(file, JSON.stringify(map, null, 2) + "\n", "utf-8");
        }
    } catch {
        file = null;
    }
    return { file };
}
