import { prisma } from "@/lib/prisma";
import { gatherChartInputs } from "@/lib/character-map-inputs";
import { DEFAULT_GENERATOR_MODEL, generateChart, saveChart, type GeneratorModel } from "@/lib/character-map-generate";
import type { CharacterMapJob } from "@prisma/client";

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
    return async (data: { status?: string; step?: string }) => {
        if (data.status) status = data.status;
        const step = data.step ?? log[log.length - 1].step;
        const last = log[log.length - 1];
        const ticking = /…\s*\d+K characters$/.test(step) && /…\s*\d+K characters$/.test(last.step);
        if (ticking) log[log.length - 1] = { t: last.t, status, step };
        else if (last.step !== step || last.status !== status) log.push({ t: new Date().toISOString(), status, step });
        await prisma.characterMapJob.update({ where: { id }, data: { status, step, log } }).catch(() => undefined);
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
export async function startJob(mdlSlug: string, startedBy: string | null, titles: Record<string, string> = {}, model: GeneratorModel = DEFAULT_GENERATOR_MODEL): Promise<JobView> {
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
    void run(job.id, mdlSlug, titles, model);
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
            warnings: [
                "Simulated run — ANTHROPIC_API_KEY is not set, so nothing was written",
                'en.wikipedia: the search found "See You at Work Tomorrow!", which is not this drama — pin a title in wiki-titles.json and regenerate',
            ],
            finishedAt: new Date(),
        },
    }).catch(() => undefined);
}

async function run(id: string, mdlSlug: string, titles: Record<string, string>, model: GeneratorModel) {
    const set = stepWriter(id, { status: "queued", step: "Starting" });
    try {
        await set({ status: "gathering", step: "Reading the MDL entry" });
        const inputs = await gatherChartInputs(mdlSlug, titles, (step) => void set({ step }));
        const found = inputs.wiki.filter((w) => w.text).map((w) => w.lang);
        await set({ status: "generating", step: `Writing the chart from the cast${found.length ? ` and ${found.join(", ")}.wikipedia` : " alone (no article found)"}` });
        const result = await generateChart(inputs, model, (step) => void set({ step }));
        await set({ status: "validating", step: "Saving" });
        const { file } = await saveChart(result.map, "claude");
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
        await set({ status: "failed", step: "Failed" });
        await prisma.characterMapJob.update({
            where: { id },
            data: { step: "", error: message, finishedAt: new Date() },
        }).catch(() => undefined);
    }
}
