"use server";

import { prisma } from "@/lib/prisma";

export type CronJobStatus = {
    id: string;
    label: string;
    /** When it is meant to run, for reading a silence against. */
    schedule: string;
    what: string;
    lastRun: Date | null;
    success: boolean | null;
    error: string | null;
    durationMs: number | null;
    /** The figures worth seeing, already named for a reader. */
    figures: { label: string; value: string }[];
    /** Set when the run looks wrong rather than merely old. */
    warning: string | null;
};

/**
 * Every scheduled job writes one SyncLog row, keyed by its own id, and until
 * now nothing read two of them.
 *
 * The three run separately on purpose — /api/cron/sync is greedy to 270 of its
 * 300 seconds and starves anything sharing its route — and that separation is
 * exactly why a single page has to gather them: three jobs failing
 * independently is only an improvement if somebody can see which one did.
 */
const JOBS: { id: string; label: string; schedule: string; what: string }[] = [
    {
        id: "daily-sync",
        label: "Watchlist sync",
        schedule: "06:00",
        what: "Backdrops, airing status, and MDL figures for everything you are watching or plan to.",
    },
    {
        id: "airing-ratings",
        label: "Airing now",
        schedule: "07:00",
        what: "A daily reading for every Korean and Chinese drama on air, plus MDL's own last thirteen days.",
    },
    {
        id: "recent-history",
        label: "Finished shows",
        schedule: "08:00",
        what: "Ratings, rank and audience for the completed titles in your watchlist.",
    },
];

/** Only the keys worth a reader's attention, in the order they make sense. */
const FIGURE_LABELS: Record<string, string> = {
    count: "recorded",
    eligible: "eligible",
    detailed: "with audience",
    backfilled: "days backfilled",
    pages: "list pages",
    matched: "matched",
    scraped: "scraped",
};

function readFigures(results: unknown): { label: string; value: string }[] {
    if (!results || typeof results !== "object") return [];
    const source = results as Record<string, unknown>;

    // The sync job nests its work under `tasks`; the other two are flat. Both
    // shapes are folded here rather than in the component, which should not
    // have to know how a job chose to report itself.
    const tasks = Array.isArray(source.tasks) ? (source.tasks as Record<string, unknown>[]) : null;
    if (tasks) {
        return tasks
            .filter((t) => typeof t.task === "string")
            .map((t) => ({
                label: String(t.task).replace(/-/g, " "),
                value: t.success === false ? "failed" : `${t.count ?? 0}`,
            }));
    }

    return Object.entries(FIGURE_LABELS)
        .filter(([key]) => typeof source[key] === "number")
        .map(([key, label]) => ({ label, value: String(source[key]) }));
}

export async function getCronStatus(): Promise<CronJobStatus[]> {
    const rows = await prisma.syncLog.findMany({ where: { id: { in: JOBS.map((j) => j.id) } } });
    const byId = new Map(rows.map((r) => [r.id, r]));

    return JOBS.map((job) => {
        const row = byId.get(job.id);
        const results = (row?.results ?? null) as Record<string, unknown> | null;
        const figures = readFigures(results);

        // A job that ran and recorded nothing is the failure that does not
        // announce itself: the request succeeded, the row was written, and MDL
        // simply refused every page. Worth saying out loud.
        let warning: string | null = null;
        if (row && results) {
            const eligible = typeof results.eligible === "number" ? results.eligible : null;
            const count = typeof results.count === "number" ? results.count : null;
            if (eligible !== null && count !== null && eligible > 0 && count < eligible * 0.6) {
                warning = `Only ${count} of ${eligible} titles came back — MDL is likely refusing pages.`;
            } else if (count === 0 && eligible === null && !Array.isArray(results.tasks)) {
                warning = "Ran, but recorded nothing.";
            }
        }

        return {
            ...job,
            lastRun: row?.lastSync ?? null,
            success: results && typeof results.success === "boolean" ? results.success : row ? true : null,
            error: results && typeof results.error === "string" ? results.error : null,
            durationMs: results && typeof results.duration === "number" ? results.duration : null,
            figures,
            warning,
        };
    });
}
