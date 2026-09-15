"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, Check } from "lucide-react";
import type { JobView } from "@/lib/character-map-jobs";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";

/**
 * The admin's way to have a chart written: one button, a line under it that
 * follows the run ("Reading ko.wikipedia", "Writing the chart… 14K
 * characters"), and the page refreshed when it lands. Polls the job row
 * every two seconds while a run goes — a long-lived process on the other
 * side, so nothing fancier is needed.
 *
 * Only rendered for the admin; the route is the actual guard.
 */
const ACTIVE = new Set(["queued", "gathering", "generating", "validating"]);

// List price of the model that ran, to say what a run cost
function costOf(job: JobView): string | null {
    if (job.inputTokens == null || job.outputTokens == null) return null;
    const price = Object.values(GENERATOR_MODELS).find((m) => job.model?.startsWith(m.id.replace(/-\d+$/, ""))) ?? GENERATOR_MODELS.opus;
    const usd = (job.inputTokens * price.input + (job.cacheRead ?? 0) * price.cacheRead + job.outputTokens * price.output) / 1_000_000;
    return `$${usd.toFixed(2)}`;
}

export function CharacterMapGenerateButton({ mdlSlug, hasChart, initialJob }: { mdlSlug: string; hasChart: boolean; initialJob: JobView | null }) {
    const [job, setJob] = useState<JobView | null>(initialJob);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [model, setModel] = useState<GeneratorModel>(DEFAULT_GENERATOR_MODEL);
    const router = useRouter();
    const active = !!job && ACTIVE.has(job.status);
    // Whether a run was started or followed here. The last row is handed in
    // so a run survives a reload, but its outcome — a failure from a click
    // days ago — is not news the page should repeat on every visit.
    const wasActive = useRef(false);

    // Follow a run while it goes; refresh the page once it lands
    useEffect(() => {
        if (!active || !job) return;
        wasActive.current = true;
        const timer = setInterval(async () => {
            try {
                const res = await fetch(`/api/admin/character-maps/jobs/${job.id}`, { cache: "no-store" });
                if (!res.ok) return;
                const { job: next } = (await res.json()) as { job: JobView };
                setJob(next);
                if (!ACTIVE.has(next.status)) {
                    clearInterval(timer);
                    if (next.status === "done") router.refresh();
                }
            } catch {
                // a missed poll is fine; the next one catches up
            }
        }, 2000);
        return () => clearInterval(timer);
    }, [active, job, router]);

    async function start() {
        if (hasChart && !window.confirm("Regenerate this chart? The current one is replaced.")) return;
        setStarting(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/character-maps/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mdlSlug, model }),
            });
            const data = (await res.json().catch(() => ({}))) as { job?: JobView; error?: string };
            if (!res.ok || !data.job) {
                setError(data.error ?? `HTTP ${res.status}`);
                return;
            }
            wasActive.current = true;
            setJob(data.job);
        } catch (e) {
            setError(e instanceof Error ? e.message : "failed");
        } finally {
            setStarting(false);
        }
    }

    const label = active ? "Generating…" : hasChart ? "Regenerate chart" : "Generate chart";
    const cost = job?.status === "done" ? costOf(job) : null;

    return (
        <div className="flex flex-col items-end gap-1 text-right">
            <div className="flex items-center gap-1.5">
            {!active && (
                <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as GeneratorModel)}
                    className="rounded-full bg-surface-2 px-2 py-1 text-xs text-fg-dim outline-none hover:text-fg"
                    title="Which model writes the chart"
                >
                    {(Object.keys(GENERATOR_MODELS) as GeneratorModel[]).map((k) => (
                        <option key={k} value={k}>
                            {GENERATOR_MODELS[k].label}
                        </option>
                    ))}
                </select>
            )}
            <button
                type="button"
                onClick={start}
                disabled={active || starting}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-default disabled:opacity-60"
                title="Write the relationship chart with Claude (admin)"
            >
                {active || starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {label}
            </button>
            </div>
            {active && job && <span className="text-xs text-fg-dim">{job.step || job.status}</span>}
            {error && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> {error}
                </span>
            )}
            {!active && job?.status === "failed" && wasActive.current && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> {job.error ?? "failed"}
                </span>
            )}
            {!active && job?.status === "done" && wasActive.current && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <Check className="h-3 w-3" /> {job.step}
                    {cost && <span className="text-fg-dim"> · {cost}</span>}
                </span>
            )}
            {!active && job?.status === "done" && job.warnings.length > 0 && (
                <button type="button" onClick={() => setShowDetails((v) => !v)} className="text-xs text-fg-dim hover:text-fg">
                    {job.warnings.length} warning{job.warnings.length === 1 ? "" : "s"}
                </button>
            )}
            {showDetails && job?.warnings.length ? (
                <ul className="max-w-md space-y-0.5 text-left text-xs text-fg-dim">
                    {job.warnings.map((w, i) => (
                        <li key={i}>· {w}</li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
