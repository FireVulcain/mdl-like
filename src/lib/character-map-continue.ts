import Anthropic from "@anthropic-ai/sdk";
import type { CharacterMapData } from "@/lib/character-map";
import type { CastMember, Recap } from "@/lib/character-map-inputs";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";
import { applyPatch, type ChartPatch, type GenerationContext, type GenerationPlan, type MergeResult } from "@/lib/character-map-patch";
import { checkSources } from "@/lib/character-map-sources";
import { linkWarnings, turnBrackets } from "@/lib/character-map-checks";
import { MOMENTS_PER_PAIR, MOMENTS_PER_STOP, TIES_PER_HEAD_AT_STOP, TIES_PER_LEAD_PAIR, TIES_PER_PAIR, TIES_PER_PERSON_AT_STOP } from "@/lib/character-map-rules";
import { chartAsText, passLine, settleChart, type Pass } from "@/lib/character-map-review";

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
 *
 * After the merge, the same review a full run gets (character-map-review.ts),
 * told which links are new: the budgets, the direction of the new ties.
 */

const CONTINUE_RULES = `You carry a Korean or Chinese drama's character relationship chart forward over the episodes that have aired since it was last read. You are given the chart as it stands, a digest of the episodes already read, the recaps of the new episodes in full, and the MDL cast list. You answer with a patch — what to add and what to change — never with a whole chart.

TWO KINDS OF LINK — this is the rule everything else follows
- kind "tie": what LASTS between two people (a mother, a marriage, a rivalry, a job). Drawn as a line, holding from since to until.
- kind "event": what HAPPENED ONCE (a rescue, a kiss, a betrayal, a confession, a reveal, a death at someone's hand). Never drawn; read in the panel and in a list in the story's order. An event has since and no until.
- The test: "does this still describe them next episode?" Yes → tie. No → event. When an event changes what two people are to each other, write both: the event, and the tie it opens (or the until on the tie it ends).
- A tie that changes over the run is TWO ties, each with its own since and its own sentence, not one link rewritten. Rivals in episode 2 who become allies in episode 10 are "rivalry, since 2" and "friend, since 10". Give the first one until: 9 so the chart stops drawing it where the second takes over, and add the second. Never change the first one's type.
- A tie the new episodes end (a death, a firing, a parting) gets its until in updateLinks — never a family tie: kinship does not end, a mother who dies is still his mother, and her death is an event. The chart draws every tie that holds as of an episode, and it must stay sparse: at most ${TIES_PER_PAIR} ties holding at once between two people (${TIES_PER_LEAD_PAIR} between two leads), never two of the same type. When you add one more, end one — or ask whether it is an event.
- An arc tie starts only when the relationship changes enough that a viewer would call it something else — strangers, then in love, then broken up. Not one per recap by default: the same state in new words ("growing closer", "closer still") is the old tie, and a gesture on the way is an event.
- Across the chart, at any episode: at most ${TIES_PER_PERSON_AT_STOP} ties holding at once on one support role (family aside), and about ${TIES_PER_HEAD_AT_STOP} ties per person the chart has met by then. A support role that needs more is a lead — put them in compact.center — or is carrying a job or a deal that belongs in the note.
- Three levels. identity (who he is to her: family, friends, boss, fan, ex, the couple) is a tie and may be in the whole story. arc (a phase of a romance, a passing rivalry, a suspicion, an alliance, a deal) is a dated tie with wholeStory false. detail (a job, a backstory, a business arrangement, a subplot role) is never a tie: a note, or an event. A misunderstanding is an event, not a tie. short is a noun or a state, never a past-tense verb.
- wholeStory: the chart's "Whole story" view keeps one defining tie per pair (two between leads) — the one a viewer would name, not the latest state. A new tie is wholeStory false unless it is the first identity tie of a pair the whole story does not show yet. Leave the whole-story marks of existing links alone. On an event, write false.
- Do not add a tie that only says "is in this block" (his guard, her squad, his assistant) for a face the chart has, or for a new face no sentence names for anything else.
- So the ordinary work of a continue run is addLinks — mostly events, and the few ties that stand behind them. updateLinks and removeLinks are for a chart that was WRONG, not for a story that moved on.
- A link in the chart marked "moment" is an event; every other one is a tie. On a chart written before the two were told apart, a tie of one episode ("since ep 6, until ep 6") is a moment in all but name — leave it alone.

WHAT TO ADD (addLinks)
- Events the new recaps bring that a viewer would remember: a rescue, a betrayal, a kiss, a parent revealed, a death — the turns, not every gesture: about ${MOMENTS_PER_STOP} per new recap across the chart, and at most ${MOMENTS_PER_PAIR} in all between two people who are not both leads. Ties the new recaps open: a marriage, a new colleague, an alliance, a debt.
- Read every new directed tie back before writing it: "<from> is <to>'s <short>". From the father, "his father"; from the son, "his son" — the possessive in short points at to.
- since: the first episode of the recap the sentence is in ("Episodes 13-14" → 13). evidence: the sentence itself, quoted. source: the site as the recap's section heads it, and its range — "dramabeans ep. 13-14", "thereviewgeek ep. 13", "cpophome ep. 12" — the recap the sentence is in, and no other: the checks find the sentence back and correct a wrong number. An event happens in the episode its sentence is in, never earlier because it "was coming"; a reveal is dated by the recap that reveals it.
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
    kind: { type: "string", enum: ["tie", "event"] },
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
    wholeStory: { type: "boolean" },
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
    passes: Pass[];
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
        // Thinking counts against this too; see generateChart
        max_tokens: 128000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: { type: "json_schema", schema: PATCH_SCHEMA } },
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

    const first: Pass = { name: "changes", model: message.model, usage, chars: text.length };
    onProgress?.(passLine(first));
    onProgress?.("Folding the changes in");
    let merged: MergeResult;
    try {
        merged = applyPatch(map, patch, recaps);
        // The links this run added are the last ones: only they are checked,
        // the rest were checked when they were written (or by hand)
        const added = merged.map.links.slice(merged.map.links.length - merged.summary.added);
        merged.warnings.push(...turnBrackets(added, merged.map.people));
        // Each sentence found back in its recap: a source that names another
        // episode is corrected, a reveal dated before its recap is moved to it
        const sourced = checkSources(merged.map.links, recaps);
        merged.map.links = sourced.links;
        merged.warnings.push(...sourced.warnings);
        merged.warnings.push(...linkWarnings(sourced.links.slice(sourced.links.length - merged.summary.added), merged.map.people));
        // The whole story, the review of what is new, the budgets — over the chart as it now stands
        const newFrom = merged.map.links.length - merged.summary.added;
        const settled = await settleChart(merged.map, { model, review: true, focus: { from: newFrom }, onProgress });
        merged.map = settled.map;
        merged.warnings.push(...settled.warnings);
        for (const p of settled.passes) onProgress?.(passLine(p));
        // A run that read new episodes and found nothing is worth saying out
        // loud: either the recaps carry no tie, or the chart already had them.
        if (merged.summary.added === 0 && merged.summary.updated === 0) merged.warnings.push("the new episodes added no link — nothing in them was a tie the chart did not have");
        const known = new Set(recaps.map((r) => r.url));
        const digests = (patch.digests ?? []).filter((d) => known.has(d.url));
        const strays = (patch.digests ?? []).length - digests.length;
        if (strays > 0) merged.warnings.push(`${strays} digest${strays === 1 ? "" : "s"} named a recap that is not kept for this entry, dropped`);
        const passes = [first, ...settled.passes];
        const spent = [...passes.map((p) => p.usage), ...(settled.failed ? [settled.failed] : [])];
        return {
            ...merged,
            patch,
            digests,
            model: message.model,
            passes,
            usage: {
                inputTokens: spent.reduce((n, u) => n + u.inputTokens, 0),
                outputTokens: spent.reduce((n, u) => n + u.outputTokens, 0),
                cacheRead: spent.reduce((n, u) => n + u.cacheRead, 0),
            },
        };
    } catch (e) {
        throw fail(e instanceof Error ? e.message : String(e));
    }
}
