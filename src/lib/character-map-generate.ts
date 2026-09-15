import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData, Era, MapLink, MapPerson } from "@/lib/character-map";
import type { ChartInputs } from "@/lib/character-map-inputs";
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

COMPACT
- compact.people: the cut the compact view shows — the leads, their households, and whoever the story turns on; whole groups, never half of one. A big school class or a village can be left out of the cut and stays in the full view.
- compact.blocks: each group other than Leads gets a cell of a 3x3 grid, [column, row]: [0,0] top-left, [2,0] top-right, [0,2] bottom-left, [2,2] bottom-right, [1,0] top-middle, [1,2] bottom-middle. The leads own [1,1]. Every group that has a person in compact.people must have a cell.
- compact.center: the two leads (or three when MDL lists three co-leads).
- main: the ids of MDL's Main roles, leads first.

OUTPUT
- version is always 1. mdlSlug, title, native, year and country are given. sources lists what was read, e.g. ["MDL cast (21 roles, 4 main)", "MDL synopsis", "ko.wikipedia 등장인물"].
- Write everything in English except evidence, which is quoted in the language it was read in.
- Do not write still or asianwiki fields.`;

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
                required: ["from", "to", "type", "label", "short", "evidence", "source", "reveal", "inferred", "directed"],
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
                        properties: { group: { type: "string" }, column: { type: "integer", minimum: 0, maximum: 2 }, row: { type: "integer", minimum: 0, maximum: 2 } },
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
    if (draft.compact.center.length < 2) throw new Error("fewer than two leads in compact.center");

    const blocks: Record<string, [number, number]> = {};
    for (const b of draft.compact.blocks) blocks[b.group] = [b.column, b.row];
    const center = new Set(draft.compact.center);
    const keep = new Set(draft.compact.people);
    for (const p of draft.people) {
        if (center.has(p.id) || !keep.has(p.id)) continue;
        if (!(p.group in blocks)) throw new Error(`group "${p.group}" is in the compact cut but has no cell`);
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
    const links: MapLink[] = draft.links.map((l) => ({ ...l }));

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
    Object.assign(map, { native: draft.native || inputs.native, year: draft.year ?? inputs.year, country: draft.country || countryCode(inputs.country) });
    return { map, warnings };
}

function countryCode(country: string): string {
    return country.includes("Korea") ? "KR" : country.includes("China") ? "CN" : country.includes("Japan") ? "JP" : country.includes("Taiwan") ? "TW" : country.includes("Thai") ? "TH" : country;
}

/* ------------------------------------------------------------ the call */

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
    stream.on("text", (delta) => {
        chars += delta.length;
        if (onProgress && chars % 2000 < delta.length) onProgress(`Writing the chart… ${Math.round(chars / 1000)}K characters`);
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new Error(`the model declined: ${message.stop_details?.explanation ?? "refusal"}`);
    if (message.stop_reason === "max_tokens") throw new Error("the chart did not fit in the output limit");
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let draft: Draft;
    try {
        draft = JSON.parse(text) as Draft;
    } catch {
        throw new Error("the model's output was not JSON");
    }
    onProgress?.("Checking the chart");
    const { map, warnings } = validateChart(draft, inputs);
    return {
        map,
        warnings,
        model: message.model,
        usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 },
    };
}

/* ------------------------------------------------------------ the save */

/**
 * The row the pages read, and the file the seed script reads — written when
 * the charts folder is there and writable, which it is on the server as in
 * development. The file keeps the repo the source of truth; commit it.
 */
export async function saveChart(map: CharacterMapData, source: string): Promise<{ file: string | null }> {
    const dataJson = map as unknown as Prisma.InputJsonValue;
    await prisma.characterMap.upsert({
        where: { mdlSlug: map.mdlSlug },
        create: { mdlSlug: map.mdlSlug, dataJson, source },
        update: { dataJson, source },
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
