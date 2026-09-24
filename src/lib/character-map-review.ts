import Anthropic from "@anthropic-ai/sdk";
import { isEvent, type CharacterMapData } from "@/lib/character-map";
import { draftFrom, linkFrom } from "@/lib/character-map-links";
import { GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";
import { pastActTies, turnBrackets } from "@/lib/character-map-checks";
import { densityWarnings, settleWholeStory, TIES_PER_LEAD_PAIR, TIES_PER_PAIR, TIES_PER_PERSON_AT_STOP, WHOLE_PER_PERSON } from "@/lib/character-map-rules";

/**
 * The second pass over a chart: a short read of the chart itself — never
 * the recaps — for what the first pass decides badly while it reads the
 * story. Three things, all seen only once the chart is whole:
 *
 * - the budgets: which tie of a crowded person to end, which one was a
 *   moment all along, which one is a job for the note;
 * - the direction of each directed tie, read back as a plain sentence
 *   ("Kang Pil Beom is Kang Myeong Hui's son"), where a tie written the
 *   wrong way round is plain to see — the bracket check only catches the
 *   ones a "[X's Y]" note proves;
 * - the layout: a lead nobody declared, a group in the wrong cell.
 *
 * It answers with edits, never a chart, and its edits are held to a short
 * list: end a tie, make a tie a moment or a moment a tie, take a tie out of
 * the whole story, turn a tie round, set a person's note, move the layout.
 * It never removes a link and never writes a new one: the story is the
 * first pass's, read from the sentences; this pass only files it.
 *
 * Cheap on purpose: the chart as text is a tenth of the recaps, and the
 * answer is a few dozen edits. When it fails the chart is kept as the
 * first pass wrote it — a review is worth having, not worth a lost run.
 */

/* ------------------------------------------------------------ the chart */

/**
 * The chart written out for a model: the people it can name, and the links
 * numbered, since a change is addressed by number. One line each — the
 * JSON would cost twice as much for the same facts, and the image URLs say
 * nothing to a reader of the story. The continue run reads the same text.
 */
export function chartAsText(map: CharacterMapData): string {
    const out: string[] = [];
    out.push(`CHART: ${map.title}${map.year ? ` (${map.year})` : ""} — read to episode ${map.recaps?.episodes ?? "?"}`);
    out.push("", "PEOPLE (id | name | actor | group):");
    for (const p of map.people) out.push(`- ${p.id} | ${p.name} | ${p.actor} | ${p.group}${p.inCast ? "" : " | not in MDL's cast"}${p.note ? ` | ${p.note}` : ""}`);
    out.push("", `LEADS: ${(map.compact.center ?? map.main.slice(0, 2)).join(", ")}`);
    out.push("", "LINKS (use the number to change one):");
    map.links.forEach((l, i) => {
        const marks = [l.directed ? "directed" : null, l.reveal ? "reveal" : null, l.inferred ? "inferred" : null, !isEvent(l) && l.wholeStory === false ? "not in whole story" : null].filter(Boolean).join(", ");
        const when = isEvent(l) ? `moment, ep ${l.since ?? "?"}` : l.since == null ? "from the start" : `since ep ${l.since}${l.until != null ? `, until ep ${l.until}` : ""}`;
        out.push(`#${i} ${l.from} → ${l.to} | ${l.type} | "${l.short}" | ${l.label} | ${when}${marks ? ` | ${marks}` : ""}`);
        if (l.evidence) out.push(`     evidence: ${l.evidence}${l.source ? ` — ${l.source}` : ""}`);
    });
    return out.join("\n");
}

// "his son" → "son": the role a short names, without its possessive
const role = (short: string) => short.trim().replace(/^(his|her|their|the)\s+/i, "");
const nameOf = (map: CharacterMapData, id: string) => map.people.find((p) => p.id === id)?.name.split(" / ")[0] ?? id;

/**
 * Every directed tie read back the way the chart draws it: the short under
 * `from`, as `from`'s role to `to`. "Kang Pil Beom is Kang Myeong Hui's
 * son" reads wrong to anyone who knows the father from the son.
 */
export function directionSentences(map: CharacterMapData): string[] {
    return map.links.flatMap((l, i) => (isEvent(l) || !l.directed ? [] : [`#${i}: ${nameOf(map, l.from)} is ${nameOf(map, l.to)}'s ${role(l.short)}`]));
}

/* ------------------------------------------------------------ the rules */

const REVIEW_RULES = `You review a character relationship chart (인물관계도) for a Korean or Chinese drama, written by a first reader from the cast, the articles and the episode recaps. You do not see the sources: you see the chart, its links numbered, each with the sentence it was read from, and the problems the checks found. You answer with edits by number — never a new link, never a removed one.

What you may change, and when:
- until on a tie: end a tie the story is done with, so fewer ties hold at once. Never on a family tie: kinship does not end, a mother who dies is still his mother. A job, a mentorship, a romance, an alliance may end — with a death too.
- until null: reopen a family tie that was given an until.
- kind: "event" for a tie that is really something that happened once (a rescue, a betrayal, "saved him as a child", "her captor" for one episode) — only when it has an episode (since). kind "tie" for a moment that is really what lasts between two people.
- wholeStory false: take a tie out of the "Whole story" panorama, which keeps only the tie that defines each pair (two between the leads) and at most ${WHOLE_PER_PERSON} per person who is not a lead, family aside. The defining tie is the one a viewer would name, not the latest state. Arcs — a phase of a romance, a passing rivalry, a suspicion, a deal — are never in it.
- turn true: swap from and to on a directed tie whose sentence reads wrong. The chart writes short under from: a directed tie reads "<from> is <to>'s <short>". "Kang Pil Beom is Kang Myeong Hui's son" when Pil Beom is the father: turn it. Only turn when the sentence is plainly wrong from the label, the evidence or the people's notes.
- notes: a job, a backstory or a deal that crowds a person belongs in their note — write the note, and end or unmark the tie. Keep a note to one short line.
- center: the leads the chart is drawn around. A support role that holds more than ${TIES_PER_PERSON_AT_STOP} ties at every stop, besides family, is often a lead nobody declared: put them in center (three at most).
- blocks and addToCompact: a group placed in the wrong cell, a household the compact cut split. Cells are [column, row] on a 3x3 grid; the leads own [1,1]; [0,*] is the left column, [2,*] the right, [1,0] and [1,2] the bands above and below.

The budgets: between two people at most ${TIES_PER_PAIR} ties holding at any episode (${TIES_PER_LEAD_PAIR} between two leads); at most ${TIES_PER_PERSON_AT_STOP} ties holding at once on a person who is not a lead, family aside.

Work from the problems listed and the direction sentences. Leave everything else alone: a chart that reads right needs no edit, and an empty answer is a good answer. Give every edit a short why.`;

/* ---------------------------------------------------------- the schema */

const BLOCK = {
    type: "object",
    additionalProperties: false,
    required: ["group", "column", "row"],
    properties: { group: { type: "string" }, column: { type: "integer", enum: [0, 1, 2] }, row: { type: "integer", enum: [0, 1, 2] } },
} as const;

export const REVIEW_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["edits", "notes", "center", "addToCompact", "blocks"],
    properties: {
        edits: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["link", "why", "set"],
                properties: {
                    link: { type: "integer" },
                    why: { type: "string" },
                    set: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            until: { type: ["integer", "null"] },
                            kind: { type: "string", enum: ["tie", "event"] },
                            wholeStory: { type: "boolean" },
                            turn: { type: "boolean" },
                        },
                    },
                },
            },
        },
        notes: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["person", "note"], properties: { person: { type: "string" }, note: { type: "string" } } },
        },
        /** empty keeps the leads as they are */
        center: { type: "array", items: { type: "string" } },
        addToCompact: { type: "array", items: { type: "string" } },
        blocks: { type: "array", items: BLOCK },
    },
} as const;

export type ReviewEdit = { link: number; why: string; set: { until?: number | null; kind?: "tie" | "event"; wholeStory?: boolean; turn?: boolean } };
export type Review = {
    edits: ReviewEdit[];
    notes: { person: string; note: string }[];
    center: string[];
    addToCompact: string[];
    blocks: { group: string; column: number; row: number }[];
};

/* ----------------------------------------------------------- the merge */

/**
 * The chart with the review's edits folded in. An edit the rules do not
 * allow — an until on a family tie, a moment with no episode, an until
 * before its since — is skipped with a warning; everything the review does
 * not name is kept as it was. Each change is a warning ending "— reviewed:
 * <why>", which the panel files with what the checks put right.
 */
export function applyReview(map: CharacterMapData, review: Review): { map: CharacterMapData; warnings: string[]; changed: number } {
    const warnings: string[] = [];
    const ids = new Set(map.people.map((p) => p.id));
    const links = [...map.links];
    let changed = 0;
    for (const edit of review.edits ?? []) {
        const current = Number.isInteger(edit.link) ? links[edit.link] : undefined;
        if (!current) {
            warnings.push(`review: link #${edit.link} does not exist, skipped`);
            continue;
        }
        const name = `${current.from} → ${current.to} "${current.short}"`;
        const draft = draftFrom(current);
        const set = edit.set ?? {};
        const said: string[] = [];
        if (set.turn) {
            if (!current.directed) warnings.push(`${name}: the review turned a tie that has no direction, skipped`);
            else {
                [draft.from, draft.to] = [draft.to, draft.from];
                said.push("turned round");
            }
        }
        if (set.kind && set.kind !== draft.kind) {
            if (set.kind === "event" && draft.since == null) warnings.push(`${name}: the review made it a moment, but it has no episode, skipped`);
            else {
                draft.kind = set.kind;
                if (set.kind === "event") draft.until = null;
                said.push(set.kind === "event" ? "now a moment" : "now a tie");
            }
        }
        if (set.until !== undefined && draft.kind === "tie") {
            if (set.until != null && draft.type === "family") warnings.push(`${name}: the review ended a family tie, skipped — kinship does not end`);
            else if (set.until != null && draft.since != null && set.until < draft.since) warnings.push(`${name}: the review's until ${set.until} comes before its since ${draft.since}, skipped`);
            else if (set.until !== draft.until) {
                draft.until = set.until;
                said.push(set.until == null ? "reopened" : `ends at ${set.until}`);
            }
        }
        if (set.wholeStory != null && draft.kind === "tie" && set.wholeStory !== draft.wholeStory) {
            draft.wholeStory = set.wholeStory;
            said.push(set.wholeStory ? "back in the whole story" : "out of the whole story");
        }
        if (!said.length) continue;
        links[edit.link] = linkFrom(draft, current);
        changed++;
        warnings.push(`${draft.from} → ${draft.to} "${draft.short}": ${said.join(", ")} — reviewed: ${edit.why || "no reason given"}`);
    }

    const people = map.people.map((p) => {
        const note = (review.notes ?? []).find((n) => n.person === p.id)?.note.trim();
        return note ? { ...p, note } : p;
    });
    for (const n of review.notes ?? []) if (!ids.has(n.person)) warnings.push(`review: a note for "${n.person}", who is not in the chart, skipped`);

    const compact = { ...map.compact, people: [...map.compact.people], blocks: { ...map.compact.blocks } };
    const center = (review.center ?? []).filter((id) => ids.has(id));
    if (center.length >= 2 && center.length <= 3 && center.join() !== (compact.center ?? []).join()) {
        compact.center = center;
        for (const id of center) if (!compact.people.includes(id)) compact.people.push(id);
        warnings.push(`the leads are now ${center.join(", ")} — reviewed`);
    }
    for (const id of review.addToCompact ?? []) if (ids.has(id) && !compact.people.includes(id)) compact.people.push(id);
    for (const b of review.blocks ?? []) {
        if (b.column >= 0 && b.column <= 2 && b.row >= 0 && b.row <= 2 && !(b.column === 1 && b.row === 1)) compact.blocks[b.group] = [b.column, b.row];
    }
    return { map: { ...map, people, links, compact }, warnings, changed };
}

/* ------------------------------------------------------------ the call */

export type PassUsage = { inputTokens: number; outputTokens: number; cacheRead: number };

/** What the review is shown: the chart, its layout, what the checks found, and the direction sentences. */
export function reviewMessage(map: CharacterMapData, problems: string[], focus?: { from: number }): string {
    const out = [chartAsText(map)];
    const blocks = Object.entries(map.compact.blocks).map(([g, [c, r]]) => `${g} [${c},${r}]`).join("; ");
    out.push("", "LAYOUT:", `center: ${(map.compact.center ?? []).join(", ")}`, `compact cut: ${map.compact.people.join(", ")}`, `blocks: ${blocks || "none"}`);
    const groups = [...new Set(map.people.map((p) => p.group))];
    out.push(`groups: ${groups.join("; ")}`);
    out.push("", "PROBLEMS THE CHECKS FOUND:", ...(problems.length ? problems.map((p) => `- ${p}`) : ["- none"]));
    const sentences = directionSentences(map);
    if (sentences.length) out.push("", "DIRECTED TIES, READ BACK (turn the ones that read wrong):", ...sentences);
    if (focus) out.push("", `The links from #${focus.from} on are new in this run: review those, and the problems above. The older ones were reviewed before — leave them unless a problem names them.`);
    return out.join("\n");
}

/**
 * One short call over the chart. Returns the review and what it cost; throws
 * on an API failure or an answer that is not the schema — the caller keeps
 * the chart as it was and says so.
 */
export async function reviewChart(
    map: CharacterMapData,
    problems: string[],
    model: GeneratorModel,
    focus?: { from: number },
): Promise<{ review: Review; usage: PassUsage; model: string; chars: number }> {
    const client = new Anthropic();
    const message = await client.messages
        .stream({
            model: GENERATOR_MODELS[model].id,
            max_tokens: 32000,
            thinking: { type: "adaptive" },
            // Filing, not reading: low effort is enough, and this pass is
            // meant to cost a tenth of the first
            output_config: { effort: "low", format: { type: "json_schema", schema: REVIEW_SCHEMA } },
            system: [{ type: "text", text: REVIEW_RULES, cache_control: { type: "ephemeral" } }],
            messages: [{ role: "user", content: reviewMessage(map, problems, focus) }],
        })
        .finalMessage();
    const usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, cacheRead: message.usage.cache_read_input_tokens ?? 0 };
    if (message.stop_reason !== "end_turn") throw Object.assign(new Error(`the review stopped early (${message.stop_reason})`), { usage });
    const text = message.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    try {
        return { review: JSON.parse(text) as Review, usage, model: message.model, chars: text.length };
    } catch {
        throw Object.assign(new Error("the review's answer was not JSON"), { usage });
    }
}

/* ------------------------------------------------------ the settlement */

export type Pass = { name: string; model: string; usage: PassUsage; chars: number };

/** One line for the run's console: what a pass read and wrote, and how much of the writing was the answer itself. */
export function passLine(p: Pass): string {
    const k = (n: number) => `${(n / 1000).toFixed(1)}K`;
    // about 3.5 characters a token for JSON in English; the rest of the output is thinking
    const answer = Math.round(p.chars / 3.5);
    return `${p.name === "chart" ? "Chart" : p.name === "changes" ? "Changes" : "Review"}: ${k(p.usage.inputTokens + p.usage.cacheRead)} in, ${k(p.usage.outputTokens)} out (~${k(answer)} answer, ~${k(Math.max(0, p.usage.outputTokens - answer))} thinking)`;
}


/**
 * What every run does once its links are written — a full run over the
 * first pass's chart, a continue run over the merged one: the whole story
 * trimmed in code, the review over what the checks still find and the
 * direction sentences, then the checks again over the result. `review:
 * false` skips the call (a hand check, a run that must cost nothing more).
 * A failed review is a warning, never a lost run.
 */
export async function settleChart(
    map: CharacterMapData,
    opts: { model: GeneratorModel; review: boolean; focus?: { from: number }; onProgress?: (step: string) => void },
): Promise<{ map: CharacterMapData; warnings: string[]; passes: Pass[]; failed: PassUsage | null }> {
    const warnings: string[] = [];
    const passes: Pass[] = [];
    let failed: PassUsage | null = null;
    let whole = settleWholeStory(map);
    let next: CharacterMapData = { ...map, links: whole.links };
    warnings.push(...whole.warnings);

    const problems = [...densityWarnings(next), ...pastActTies(next.links)];
    const directed = next.links.some((l) => !isEvent(l) && l.directed);
    if (opts.review && (problems.length || directed)) {
        opts.onProgress?.(`Reviewing the chart — ${problems.length} problem${problems.length === 1 ? "" : "s"} to look at`);
        try {
            const { review, usage, model, chars } = await reviewChart(next, problems, opts.model, opts.focus);
            passes.push({ name: "review", model, usage, chars });
            const applied = applyReview(next, review);
            next = applied.map;
            warnings.push(...applied.warnings);
            // a tie a "[X's Y]" note proves stays the way the note says, whatever the review turned
            warnings.push(...turnBrackets(next.links, next.people));
            opts.onProgress?.(`Reviewed: ${applied.changed} change${applied.changed === 1 ? "" : "s"}`);
        } catch (e) {
            failed = (e as { usage?: PassUsage }).usage ?? null;
            warnings.push(`the review failed (${e instanceof Error ? e.message : String(e)}) — the chart is kept as the first pass wrote it`);
        }
        whole = settleWholeStory(next);
        next = { ...next, links: whole.links };
        warnings.push(...whole.warnings);
    }
    warnings.push(...densityWarnings(next));
    return { map: next, warnings, passes, failed };
}
