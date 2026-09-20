import Anthropic from "@anthropic-ai/sdk";
import type { CharacterMapData } from "@/lib/character-map";
import type { CastMember, Recap } from "@/lib/character-map-inputs";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";
import { applyPatch, type ChartPatch, type GenerationContext, type GenerationPlan, type MergeResult } from "@/lib/character-map-patch";

/**
 * Carrying a chart forward over the episodes that have aired since it was
 * written.
 *
 * What the model is given: the chart as it stands — its people, and its
 * links numbered, each with the sentence it was read from — the digests of
 * the recaps already read, the recaps that are new in full, and the MDL
 * cast, which is what a new face's portrait and spelling come from. What it
 * gives back is a patch, never a chart: the merge in character-map-patch.ts
 * keeps everything the patch does not name.
 *
 * Why the numbered links are enough history for most of the work: the
 * README's rule that every link keeps its sentence means the chart already
 * carries, for each established tie, the words it was read from and the
 * episode it was seen in. The digests cover what that leaves out — an
 * event that made no link, and who knows what.
 */

const CONTINUE_RULES = `You carry a Korean or Chinese drama's character relationship chart forward over the episodes that have aired since it was last read. You are given the chart as it stands, a digest of the episodes already read, the recaps of the new episodes in full, and the MDL cast list. You answer with a patch — what to add and what to change — never with a whole chart.

HOW THE CHART IS DATED — this is the rule everything else follows
- A tie that changes over the run is TWO links, each with its own since and its own sentence, not one link rewritten. Rivals in episode 2 who become allies in episode 10 are "rivalry, since 2" and "friend, since 10". Give the first one until: 9 so the chart stops drawing it where the second takes over, and add the second. Never change the first one's type.
- A moment the new episodes bring — a rescue, a slap, a kidnapping resolved next episode, a gift — is a link with since and until the same episode. A tie the new episodes end (a death, a firing, a parting) gets its until in updateLinks. The chart's end view draws every link without an until, and it must stay sparse: at most two open links between two people, never two of the same type. When you add a third, end one.
- Do not add a tie that only says "is in this block" (his guard, her squad, his assistant) for a face the chart has, or for a new face no sentence names for anything else.
- So the ordinary work of a continue run is addLinks. updateLinks and removeLinks are for a chart that was WRONG, not for a story that moved on.

WHAT TO ADD (addLinks)
- Ties the new recaps show that the chart does not have: a rescue, a betrayal, a marriage, a parent revealed, a debt, a new colleague.
- since: the first episode of the recap the sentence is in ("Episodes 13-14" → 13). evidence: the sentence itself, quoted. source: the site as the recap's section heads it, and its range — "dramabeans ep. 13-14", "cpophome ep. 12".
- reveal: true when the new episodes reveal something the story had kept — a hidden parent, a true identity, a killer. The episode of the REVEAL is the since, not the episode it is about.
- A new face the recaps name: addPeople, taking name, actor and the img= URL from the MDL cast list given below. Someone the recaps name whom the cast list does not carry gets inCast false and image null. Put anyone who matters to the leads in addToCompact, and give their group a cell in blocks if it is a new group.

WHAT TO CHANGE (updateLinks) — by the link's number, with a reason
- until, when a tie stops holding and a new link takes over.
- A correction the new episodes force: a since that was too late, a label the new episodes make precise, a tie the chart marked inferred that now has a sentence (set inferred false and give the evidence), a tie that turns out to be a reveal.
- Leave a link alone when the new episodes simply do not mention it. Silence is not a correction.

WHAT TO REMOVE (removeLinks) — almost never
- Only a link the new episodes show to be plainly wrong: the wrong person, a relation the story contradicts outright. Never because a tie ended — that is until. A patch that removes more than a fifth of the chart is refused.

DIGESTS
- For each NEW recap, write a digest of 60 to 120 words: the turns that bear on who is who — what was discovered, by whom, what was hidden, who met whom, what changed between people. Not a plot summary: the notes a reader would need in three weeks to understand a sentence like "he confronts her about what he found out". Name people by their chart id where they have one.

OUTPUT
- Write in English, except evidence, quoted in the language it was read in.
- Do not write a recaps field, a still, or an asianwiki field. Do not repeat links the chart already has.`;

const LINK_TYPES = ["family", "romance", "rivalry", "work", "friend", "bond"];
const nullable = (type: string) => ({ type: [type, "null"] });

const LINK_PROPS = {
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
} as const;

export const PATCH_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["addPeople", "addLinks", "updateLinks", "removeLinks", "addToCompact", "blocks", "digests"],
    properties: {
        addPeople: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "name", "actor", "image", "group", "inCast", "note"],
                properties: {
                    id: { type: "string" },
                    name: { type: "string" },
                    actor: { type: "string" },
                    image: nullable("string"),
                    group: { type: "string" },
                    inCast: { type: "boolean" },
                    note: nullable("string"),
                },
            },
        },
        addLinks: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: [...Object.keys(LINK_PROPS)], properties: LINK_PROPS },
        },
        updateLinks: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["link", "set", "why"],
                properties: {
                    link: { type: "integer" },
                    why: { type: "string" },
                    set: { type: "object", additionalProperties: false, properties: LINK_PROPS },
                },
            },
        },
        removeLinks: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["link", "why"], properties: { link: { type: "integer" }, why: { type: "string" } } },
        },
        addToCompact: { type: "array", items: { type: "string" } },
        blocks: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["group", "column", "row"],
                properties: { group: { type: "string" }, column: { type: "integer", enum: [0, 1, 2] }, row: { type: "integer", enum: [0, 1, 2] } },
            },
        },
        digests: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["url", "from", "to", "text"],
                properties: { url: { type: "string" }, from: { type: "integer" }, to: { type: "integer" }, text: { type: "string" } },
            },
        },
    },
} as const;

/* ------------------------------------------------------- the message */

const episodes = (from: number, to: number) => (from === to ? `Episode ${from}` : `Episodes ${from}-${to}`);
const ofRecap = (r: { fromEp: number; toEp: number }) => episodes(r.fromEp, r.toEp);

/**
 * The chart written out for the model: the people it can name, and the
 * links numbered, since a change is addressed by number. One line each —
 * the JSON would cost twice as much for the same facts, and the image URLs
 * say nothing to a reader of the story.
 */
export function chartAsText(map: CharacterMapData): string {
    const out: string[] = [];
    out.push(`CHART: ${map.title}${map.year ? ` (${map.year})` : ""} — read to episode ${map.recaps?.episodes ?? "?"}`);
    out.push("", "PEOPLE (id | name | actor | group):");
    for (const p of map.people) out.push(`- ${p.id} | ${p.name} | ${p.actor} | ${p.group}${p.inCast ? "" : " | not in MDL's cast"}${p.note ? ` | ${p.note}` : ""}`);
    out.push("", `LEADS: ${(map.compact.center ?? map.main.slice(0, 2)).join(", ")}`);
    out.push("", "LINKS (use the number to change one):");
    map.links.forEach((l, i) => {
        const marks = [l.directed ? "directed" : null, l.reveal ? "reveal" : null, l.inferred ? "inferred" : null].filter(Boolean).join(", ");
        const when = l.since == null ? "from the start" : `since ep ${l.since}${l.until != null ? `, until ep ${l.until}` : ""}`;
        out.push(`#${i} ${l.from} → ${l.to} | ${l.type} | "${l.short}" | ${l.label} | ${when}${marks ? ` | ${marks}` : ""}`);
        if (l.evidence) out.push(`     evidence: ${l.evidence}${l.source ? ` — ${l.source}` : ""}`);
    });
    return out.join("\n");
}

/** Everything the model reads for a continue run, as one message. */
export function continueMessage(map: CharacterMapData, plan: GenerationPlan, context: GenerationContext | null, cast: { main: CastMember[]; support: CastMember[]; guest: CastMember[] }): string {
    const out: string[] = [chartAsText(map)];

    const digests = (context?.digests ?? []).filter((d) => plan.covered.some(([from, to]) => from <= d.from && d.to <= to)).sort((a, b) => a.from - b.from);
    if (digests.length) {
        out.push("", "THE STORY SO FAR (a digest of each recap already read):");
        for (const d of digests) out.push("", `=== ${episodes(d.from, d.to)} ===`, d.text);
    }
    // A chart whose recaps were never digested gets them in full, once: this
    // run writes the digests, and every later one is paid for in digests.
    if (plan.undigested.length) {
        out.push("", "EPISODES ALREADY IN THE CHART, IN FULL (no digest was kept for these — write one for each):");
        for (const r of plan.undigested) out.push("", `=== ${r.source} · ${ofRecap(r)} · ${r.title} ===`, `url: ${r.url}`, r.text);
    }

    out.push("", "NEW EPISODES — these are what the chart does not have yet:");
    for (const r of plan.fresh) out.push("", `=== ${r.source} · ${ofRecap(r)} · ${r.title} ===`, `url: ${r.url}`, r.text);

    out.push("", "MDL CAST (for a new face: the actor's spelling, and the img= URL to use):");
    for (const [role, list] of [["Main Role", cast.main], ["Support Role", cast.support], ["Guest Role", cast.guest]] as const) {
        for (const m of list) out.push(`- [${role}] ${m.name} as ${m.role.name} | img=${m.profile_image ?? ""}`);
    }
    return out.join("\n");
}

/* ---------------------------------------------------------- the call */

export class ContinueError extends Error {
    constructor(message: string, public usage?: ContinueResult["usage"], public model?: string) {
        super(message);
    }
}

export type ContinueResult = MergeResult & {
    patch: ChartPatch;
    digests: { url: string; from: number; to: number; text: string }[];
    usage: { inputTokens: number; outputTokens: number; cacheRead: number };
    model: string;
};

/**
 * One streaming call that carries the chart forward, and the merge of what
 * it answers. Throws when the key is missing, when the API fails, or when
 * the patch would gut the chart.
 */
export async function continueChart(
    map: CharacterMapData,
    plan: GenerationPlan,
    context: GenerationContext | null,
    cast: { main: CastMember[]; support: CastMember[]; guest: CastMember[] },
    recaps: Recap[],
    model: GeneratorModel = DEFAULT_GENERATOR_MODEL,
    onProgress?: (step: string) => void,
): Promise<ContinueResult> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set on the server");
    const client = new Anthropic();

    const stream = client.messages.stream({
        model: GENERATOR_MODELS[model].id,
        max_tokens: 32000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high", format: { type: "json_schema", schema: PATCH_SCHEMA } },
        system: [{ type: "text", text: CONTINUE_RULES, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: continueMessage(map, plan, context, cast) }],
    });

    const began = Date.now();
    const clock = () => {
        const s = Math.round((Date.now() - began) / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    let chars = 0;
    const thinking = setInterval(() => onProgress?.(`Reading the new episodes… ${clock()}`), 10_000);
    stream.on("text", (delta) => {
        if (chars === 0) clearInterval(thinking);
        chars += delta.length;
        if (onProgress && chars % 1000 < delta.length) onProgress(`Writing the changes… ${Math.round(chars / 1000)}K characters`);
    });
    let message: Anthropic.Message;
    try {
        message = await stream.finalMessage();
    } finally {
        clearInterval(thinking);
    }
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 };
    const fail = (why: string) => new ContinueError(why, usage, message.model);
    if (message.stop_reason === "refusal") throw fail(`the model declined: ${message.stop_details?.explanation ?? "refusal"}`);
    if (message.stop_reason === "max_tokens") throw fail("the changes did not fit in the output limit");
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    let patch: ChartPatch;
    try {
        patch = JSON.parse(text) as ChartPatch;
    } catch {
        throw fail("the model's output was not JSON");
    }

    onProgress?.("Folding the changes in");
    try {
        const merged = applyPatch(map, patch, recaps);
        // A run that read new episodes and found nothing is worth saying out
        // loud: either the recaps carry no tie, or the chart already had them.
        if (merged.summary.added === 0 && merged.summary.updated === 0) merged.warnings.push("the new episodes added no link — nothing in them was a tie the chart did not have");
        const known = new Set(recaps.map((r) => r.url));
        const digests = (patch.digests ?? []).filter((d) => known.has(d.url));
        const strays = (patch.digests ?? []).length - digests.length;
        if (strays > 0) merged.warnings.push(`${strays} digest${strays === 1 ? "" : "s"} named a recap that is not kept for this entry, dropped`);
        return { ...merged, patch, digests, model: message.model, usage };
    } catch (e) {
        throw fail(e instanceof Error ? e.message : String(e));
    }
}
