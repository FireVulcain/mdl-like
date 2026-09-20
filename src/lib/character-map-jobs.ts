import { prisma } from "@/lib/prisma";
import { gatherChartInputs } from "@/lib/character-map-inputs";
import { ChartError, DEFAULT_GENERATOR_MODEL, generateChart, saveChart, type GeneratorModel } from "@/lib/character-map-generate";
import { listRecaps, recapsProblem } from "@/lib/character-map-recaps";
import { ContinueError, continueChart } from "@/lib/character-map-continue";
import { planRun, readContext, withDigests, type RunMode } from "@/lib/character-map-patch";
import type { CharacterMapData } from "@/lib/character-map";
import type { Prisma, CharacterMapJob } from "@prisma/client";

/**
 * The chart generator as a job: one row per run, progressed step by step,
 * run inside the server process — a route starts it and returns, the page
 * polls the row. The server is a long-lived Node process (not a function
 * with a timeout), so a three-minute run needs no worker; what it needs is
 * for a restart mid-run not to leave a row "generating" forever, which the
 * reaper below handles on the next start.
 */
const ACTIVE = new Set(["queued", "gathering", "generating", "validating"]);
const STALE_MS = 15 * 60 * 1000;

/** One line of the run's console: when, in what state, what it was doing. */
export type JobLogEntry = { t: string; status: string; step: string };

export type JobView = Pick<CharacterMapJob, "id" | "mdlSlug" | "status" | "step" | "error" | "model" | "inputTokens" | "outputTokens" | "cacheRead" | "peopleCount" | "linkCount" | "createdAt" | "finishedAt"> & { warnings: string[]; log: JobLogEntry[] };

export function jobView(job: CharacterMapJob): JobView {
    const { id, mdlSlug, status, step, error, model, inputTokens, outputTokens, cacheRead, peopleCount, linkCount, createdAt, finishedAt } = job;
    return {
        id, mdlSlug, status, step, error, model, inputTokens, outputTokens, cacheRead, peopleCount, linkCount, createdAt, finishedAt,
        warnings: Array.isArray(job.warnings) ? (job.warnings as string[]) : [],
        log: Array.isArray(job.log) ? (job.log as JobLogEntry[]) : [],
    };
}

/**
 * The steps a run reports, kept as a list in the row so the console can
 * show the whole run — after a reload too. The list lives here while the
 * run goes (one process, one run per row) and is written whole each time;
 * the ticks of one step ("Writing the chart… 14K characters") stay one line,
 * with the time the step began.
 */
function stepWriter(id: string, initial: { status: string; step: string }) {
    const log: JobLogEntry[] = [{ t: new Date().toISOString(), ...initial }];
    let status = initial.status;
    // Writes land in the order they were asked, one at a time: the progress
    // ticks are fired without waiting, and one of them arriving after the
    // "failed" write once left a run "generating" forever, spinner and all.
    let queue: Promise<unknown> = Promise.resolve();
    return (data: { status?: string; step?: string }) => {
        if (data.status) status = data.status;
        const step = data.step ?? log[log.length - 1].step;
        const last = log[log.length - 1];
        // A growing count ("Writing the chart… 12K characters", "Thinking it
        // over… 1:30") replaces the last line rather than adding one — but
        // thinking and writing are two lines, each with its own start time
        const tick = (s: string) => s.match(/^(.*…)\s*\S.*$/)?.[1];
        const ticking = !!tick(step) && tick(step) === tick(last.step);
        if (ticking) log[log.length - 1] = { t: last.t, status, step };
        else if (last.step !== step || last.status !== status) log.push({ t: new Date().toISOString(), status, step });
        const snapshot = { status, step, log: [...log] };
        queue = queue.then(() => prisma.characterMapJob.update({ where: { id }, data: snapshot }).catch(() => undefined));
        return queue;
    };
}

/** The most recent job for an entry, active or not — what the button shows on load. */
export async function latestJob(mdlSlug: string): Promise<JobView | null> {
    await reapStale();
    const job = await prisma.characterMapJob.findFirst({ where: { mdlSlug }, orderBy: { createdAt: "desc" } });
    return job ? jobView(job) : null;
}

export async function getJob(id: string): Promise<JobView | null> {
    const job = await prisma.characterMapJob.findUnique({ where: { id } });
    return job ? jobView(job) : null;
}

/** A run the process lost (a restart mid-way) is failed, not active forever. */
async function reapStale() {
    await prisma.characterMapJob.updateMany({
        where: { status: { in: [...ACTIVE] }, updatedAt: { lt: new Date(Date.now() - STALE_MS) } },
        data: { status: "failed", error: "the run was interrupted (server restart)", finishedAt: new Date() },
    });
}

/**
 * Starts a run for an entry, unless one is already going. Fails fast, in the
 * row, when the server has no API key — the button then says so instead of
 * spinning. Returns the row to poll.
 */
export async function startJob(
    mdlSlug: string,
    startedBy: string | null,
    titles: Record<string, string> = {},
    model: GeneratorModel = DEFAULT_GENERATOR_MODEL,
    withRecaps = false,
    /** "continue" carries the chart forward over the new recaps instead of writing it again */
    mode: RunMode = "full",
): Promise<JobView> {
    await reapStale();
    const running = await prisma.characterMapJob.findFirst({ where: { mdlSlug, status: { in: [...ACTIVE] } } });
    if (running) return jobView(running);

    const job = await prisma.characterMapJob.create({ data: { mdlSlug, status: "queued", step: "Starting", startedBy, model } });
    if (!process.env.ANTHROPIC_API_KEY) {
        // No key in development: walk the console through a pretend run, so
        // the page can be worked on without spending anything or writing a
        // chart. In production a missing key is a failure, said in the row.
        if (process.env.NODE_ENV !== "production") {
            void simulate(job.id, model);
            return jobView(job);
        }
        const failed = await prisma.characterMapJob.update({
            where: { id: job.id },
            data: { status: "failed", step: "", error: "ANTHROPIC_API_KEY is not set on the server", finishedAt: new Date() },
        });
        return jobView(failed);
    }
    // detached on purpose: the route returns now, the run goes on in the process
    void (mode === "continue" ? carryOn(job.id, mdlSlug, model) : run(job.id, mdlSlug, titles, model, withRecaps));
    return jobView(job);
}

async function simulate(id: string, model: GeneratorModel) {
    const set = stepWriter(id, { status: "queued", step: "Starting" });
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const script: [number, { status?: string; step?: string }][] = [
        [600, { status: "gathering", step: "Reading the MDL entry" }],
        [1200, { step: "Reading ko.wikipedia" }],
        [1500, { step: "Reading en.wikipedia" }],
        [900, { status: "generating", step: "Writing the chart from the cast and ko, en.wikipedia" }],
        [1500, { step: "Writing the chart… 2K characters" }],
        [1500, { step: "Writing the chart… 6K characters" }],
        [1500, { step: "Writing the chart… 11K characters" }],
        [1500, { step: "Writing the chart… 15K characters" }],
        [800, { step: "Checking the chart" }],
        [700, { status: "validating", step: "Saving" }],
    ];
    for (const [ms, data] of script) {
        await wait(ms);
        await set(data);
    }
    await wait(500);
    await set({ status: "done", step: "23 people, 31 links (simulated)" });
    await prisma.characterMapJob.update({
        where: { id },
        data: {
            model: `${model} (simulated)`,
            inputTokens: 31_000,
            outputTokens: 9_500,
            cacheRead: 12_000,
            peopleCount: 23,
            linkCount: 31,
            warnings: ["Simulated run — ANTHROPIC_API_KEY is not set, so nothing was written"],
            finishedAt: new Date(),
        },
    }).catch(() => undefined);
}

async function run(id: string, mdlSlug: string, titles: Record<string, string>, model: GeneratorModel, withRecaps: boolean) {
    const set = stepWriter(id, { status: "queued", step: "Starting" });
    try {
        await set({ status: "gathering", step: "Reading the MDL entry" });
        // the recaps the extension left in the table, when the run asked for them
        const recaps = withRecaps ? await listRecaps(mdlSlug) : [];
        // a set kept before the guard existed is still checked before it costs anything
        const problem = recaps.length ? recapsProblem(recaps) : null;
        if (problem) throw new Error(`${problem}; read the recaps again with the drama's tag or a recap's URL`);
        if (withRecaps) await set({ step: recaps.length ? `Reading ${recaps.length} Dramabeans recap${recaps.length === 1 ? "" : "s"}` : "No recaps kept for this entry — reading without" });
        const inputs = await gatherChartInputs(mdlSlug, titles, (step) => void set({ step }), recaps);
        const found = inputs.wiki.filter((w) => w.text).map((w) => w.lang);
        const read = [found.length ? `${found.join(", ")}.wikipedia` : null, recaps.length ? `${recaps.length} recaps` : null].filter(Boolean);
        await set({ status: "generating", step: `Writing the chart from the cast${read.length ? ` and ${read.join(" and ")}` : " alone (no article found)"}` });
        const result = await generateChart(inputs, model, (step) => void set({ step }));
        await set({ status: "validating", step: "Saving" });
        const { file } = await saveChart(result.map, "claude", { editedAt: null });
        const warnings = [...result.warnings];
        for (const w of inputs.wiki) if (!w.text) warnings.push(`${w.lang}.wikipedia: ${w.title ? `no character section in "${w.title}"` : w.rejected ? `the search found "${w.rejected}", which is not this drama` : "no article found"} — pin a title in wiki-titles.json and regenerate`);
        if (!file) warnings.push("the chart file was not written (folder missing or read-only); the row is the only copy");
        await set({ status: "done", step: `${result.map.people.length} people, ${result.map.links.length} links` });
        await prisma.characterMapJob.update({
            where: { id },
            data: {
                model: result.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                cacheRead: result.usage.cacheRead,
                peopleCount: result.map.people.length,
                linkCount: result.map.links.length,
                warnings,
                finishedAt: new Date(),
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // what a run that got an answer still cost, so a failure is not free-looking
        const spent = e instanceof ChartError && e.usage ? { model: e.model, inputTokens: e.usage.inputTokens, outputTokens: e.usage.outputTokens, cacheRead: e.usage.cacheRead } : {};
        await set({ status: "failed", step: "Failed" });
        await prisma.characterMapJob.update({
            where: { id },
            data: { step: "", error: message, finishedAt: new Date(), ...spent },
        }).catch(() => undefined);
    }
}

/**
 * A continue run: the chart as it stands, plus the recaps it has not read,
 * folded together by a patch. Unlike `run` above it never replaces the
 * chart — the people keep their stills, the asianwiki pin stays, and a link
 * the admin corrected by hand is left alone unless the new episodes say
 * something about that very link. `editedAt` is therefore untouched.
 */
async function carryOn(id: string, mdlSlug: string, model: GeneratorModel) {
    const set = stepWriter(id, { status: "queued", step: "Starting" });
    try {
        await set({ status: "gathering", step: "Reading the chart and the recaps" });
        const row = await prisma.characterMap.findUnique({ where: { mdlSlug } });
        if (!row) throw new Error("there is no chart to carry forward — write one first");
        const map = row.dataJson as unknown as CharacterMapData;
        const recaps = await listRecaps(mdlSlug);
        const problem = recaps.length ? recapsProblem(recaps) : null;
        if (problem) throw new Error(`${problem}; read the recaps again with the drama's tag or a recap's URL`);
        const context = readContext(row.contextJson);
        const plan = planRun(map, recaps, context);
        if (plan.mode !== "continue") throw new Error(plan.reason);

        // The cast is read again: a face that first appears in episode 13 is
        // usually a guest role, and its portrait and spelling come from MDL.
        await set({ step: "Reading the MDL cast" });
        const inputs = await gatherChartInputs(mdlSlug, {}, undefined, []);

        const fresh = plan.fresh.length;
        await set({
            status: "generating",
            step: `Carrying the chart forward over ${fresh} new recap${fresh === 1 ? "" : "s"}${plan.undigested.length ? `, and summarising ${plan.undigested.length} older one${plan.undigested.length === 1 ? "" : "s"}` : ""}`,
        });
        const result = await continueChart(map, plan, context, inputs.cast, recaps, model, (step) => void set({ step }));

        await set({ status: "validating", step: "Saving" });
        const nextContext = withDigests(context, result.digests);
        const { file } = await saveChart(result.map, row.source || "claude", { context: nextContext as unknown as Prisma.InputJsonValue });
        const warnings = [...result.warnings];
        if (!file) warnings.push("the chart file was not written (folder missing or read-only); the row is the only copy");
        const { added, updated, removed, people } = result.summary;
        const said = [
            `${added} link${added === 1 ? "" : "s"} added`,
            updated ? `${updated} changed` : null,
            removed ? `${removed} removed` : null,
            people ? `${people} new ${people === 1 ? "person" : "people"}` : null,
        ].filter(Boolean).join(", ");
        await set({ status: "done", step: `${said} — read to episode ${result.map.recaps?.episodes ?? "?"}` });
        await prisma.characterMapJob.update({
            where: { id },
            data: {
                model: result.model,
                inputTokens: result.usage.inputTokens,
                outputTokens: result.usage.outputTokens,
                cacheRead: result.usage.cacheRead,
                peopleCount: result.map.people.length,
                linkCount: result.map.links.length,
                warnings,
                finishedAt: new Date(),
            },
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const spent = e instanceof ContinueError && e.usage ? { model: e.model, inputTokens: e.usage.inputTokens, outputTokens: e.usage.outputTokens, cacheRead: e.usage.cacheRead } : {};
        await set({ status: "failed", step: "Failed" });
        await prisma.characterMapJob.update({
            where: { id },
            data: { step: "", error: message, finishedAt: new Date(), ...spent },
        }).catch(() => undefined);
    }
}
