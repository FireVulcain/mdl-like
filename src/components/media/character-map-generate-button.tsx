"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, Check, X, Zap, Gem } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { JobView } from "@/lib/character-map-jobs";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";

/**
 * The admin's way to have a chart written: one button in the section
 * header, and a panel that is first the choice of a model, then the run's
 * console — every step the server went through, timed from the start, the
 * current one live — then the summary: people, links, cost, time, and the
 * warnings the run kept. Polls the job row every two seconds while a run
 * goes; a run found active on load (a reload mid-run) opens straight onto
 * its console.
 *
 * Only rendered for the admin; the route is the actual guard.
 */
const ACTIVE = new Set(["queued", "gathering", "generating", "validating"]);

// What a run looks like in each state, for the pill in the panel's header
const STATUS_LABEL: Record<string, string> = {
    queued: "Starting",
    gathering: "Reading",
    generating: "Writing",
    validating: "Saving",
    done: "Done",
    failed: "Failed",
};

// Roughly what a chart costs on each model — a typical run is 30K in, 10K out
const MODEL_HINT: Record<GeneratorModel, { icon: typeof Zap; blurb: string; cost: string }> = {
    sonnet: { icon: Zap, blurb: "Disciplined extraction at a fraction of the price. Right for most dramas.", cost: "about 15¢ a chart" },
    opus: { icon: Gem, blurb: "Holds the rules over a long input. For the big Chinese casts and long articles.", cost: "about 40¢ a chart" },
};

// List price of the model that ran, to say what a run cost
function costOf(job: JobView): string | null {
    if (job.inputTokens == null || job.outputTokens == null) return null;
    const price = Object.values(GENERATOR_MODELS).find((m) => job.model?.startsWith(m.id.replace(/-\d+$/, ""))) ?? GENERATOR_MODELS.opus;
    const usd = (job.inputTokens * price.input + (job.cacheRead ?? 0) * price.cacheRead + job.outputTokens * price.output) / 1_000_000;
    return `$${usd.toFixed(2)}`;
}

function clock(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CharacterMapGenerateButton({ mdlSlug, hasChart, initialJob }: { mdlSlug: string; hasChart: boolean; initialJob: JobView | null }) {
    const [job, setJob] = useState<JobView | null>(initialJob);
    const [open, setOpen] = useState(false);
    // "choose" is the model panel; "run" the console for `job`
    const [view, setView] = useState<"choose" | "run">(initialJob && ACTIVE.has(initialJob.status) ? "run" : "choose");
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [model, setModel] = useState<GeneratorModel>(DEFAULT_GENERATOR_MODEL);
    // Wikipedia page titles given by hand for the next run, when the search
    // found nothing or the wrong article — the last run's warnings say which
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [pinning, setPinning] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const router = useRouter();
    const active = !!job && ACTIVE.has(job.status);
    const consoleEnd = useRef<HTMLDivElement>(null);

    // Follow a run while it goes; refresh the page once it lands
    useEffect(() => {
        if (!active || !job) return;
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

    // The clock in the console header ticks every second while a run goes
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [active]);

    // Keep the newest line in view
    useEffect(() => {
        consoleEnd.current?.scrollIntoView({ block: "nearest" });
    }, [job?.log.length, job?.step]);

    async function start() {
        setStarting(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/character-maps/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mdlSlug, model, titles }),
            });
            const data = (await res.json().catch(() => ({}))) as { job?: JobView; error?: string };
            if (!res.ok || !data.job) {
                setError(data.error ?? `HTTP ${res.status}`);
                return;
            }
            setJob(data.job);
            setView("run");
        } catch (e) {
            setError(e instanceof Error ? e.message : "failed");
        } finally {
            setStarting(false);
        }
    }

    function openPanel() {
        // A run in flight is what the panel shows; otherwise wherever it was left
        if (active) setView("run");
        setOpen(true);
    }

    const started = job ? new Date(job.createdAt).getTime() : 0;
    const ended = job?.finishedAt ? new Date(job.finishedAt).getTime() : now;
    const elapsed = job ? ended - started : 0;
    const cost = job?.status === "done" ? costOf(job) : null;
    const label = active ? "Generating…" : hasChart ? "Regenerate chart" : "Generate chart";
    // What the last run said about Wikipedia — the reason to pin a title
    const wikiWarnings = job && !active ? job.warnings.filter((w) => /wikipedia/.test(w)) : [];

    return (
        <>
            <button
                type="button"
                onClick={openPanel}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                title="Write the relationship chart with Claude (admin)"
            >
                {active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> : <Sparkles className="h-3.5 w-3.5" />}
                {label}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent showCloseButton={false} className="gap-0 border-line-strong bg-panel p-0 sm:max-w-lg">
                    {view === "choose" || !job ? (
                        <>
                            <DialogHeader className="px-6 pt-6">
                                <DialogTitle className="font-display text-lg font-semibold text-fg">{hasChart ? "Rewrite the relationship chart" : "Write the relationship chart"}</DialogTitle>
                                <DialogDescription className="text-sm text-fg-muted">
                                    Claude reads the MDL cast, the synopsis and the Wikipedia character sections, and writes the chart with the sentence behind every link.
                                    {hasChart && <span className="block pt-1 text-fg-dim">The current chart is replaced when the run lands.</span>}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-2 px-6 pt-5 sm:grid-cols-2" role="radiogroup" aria-label="Model">
                                {(Object.keys(GENERATOR_MODELS) as GeneratorModel[]).map((k) => {
                                    const hint = MODEL_HINT[k];
                                    const Icon = hint.icon;
                                    const selected = model === k;
                                    return (
                                        <button
                                            key={k}
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            onClick={() => setModel(k)}
                                            className={`group flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors ${
                                                selected ? "border-sky-400/60 bg-sky-400/10" : "border-line bg-surface-1 hover:border-line-strong hover:bg-surface-2"
                                            }`}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon className={`h-4 w-4 ${selected ? "text-sky-400" : "text-fg-dim group-hover:text-fg-soft"}`} />
                                                <span className="text-sm font-semibold text-fg">{GENERATOR_MODELS[k].label}</span>
                                                {k === DEFAULT_GENERATOR_MODEL && <span className="ml-auto rounded-full bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-dim">default</span>}
                                            </span>
                                            <span className="text-xs leading-relaxed text-fg-muted">{hint.blurb}</span>
                                            <span className="font-mono text-[11px] text-fg-dim">{hint.cost}</span>
                                        </button>
                                    );
                                })}
                            </div>
                            {wikiWarnings.length > 0 && !pinning && (
                                <div className="mx-6 mt-4 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-400/90">
                                    <ul className="space-y-1">
                                        {wikiWarnings.map((w, i) => (
                                            <li key={i} className="flex gap-2">
                                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                                <span>{w.replace(/ — pin a title.*$/, "")}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <button type="button" onClick={() => setPinning(true)} className="mt-2 font-medium text-amber-300 underline-offset-2 hover:underline">
                                        Give the Wikipedia page titles for the next run
                                    </button>
                                </div>
                            )}
                            {pinning && (
                                <div className="mx-6 mt-4 space-y-2 rounded-lg border border-line bg-surface-1 p-3">
                                    <p className="text-xs text-fg-muted">The exact page titles, as written on Wikipedia — e.g. <span className="font-mono text-fg-soft">내일 (2022년 드라마)</span>. Leave a field empty to keep searching.</p>
                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {(["ko", "zh", "en"] as const).map((lang) => (
                                            <label key={lang} className="flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1.5 text-xs">
                                                <span className="w-5 shrink-0 font-mono text-fg-dim">{lang}</span>
                                                <input
                                                    value={titles[lang] ?? ""}
                                                    onChange={(e) => setTitles((t) => ({ ...t, [lang]: e.target.value }))}
                                                    placeholder="page title"
                                                    className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-faint"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {error && (
                                <p className="inline-flex items-center gap-1.5 px-6 pt-3 text-xs text-amber-400">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                                </p>
                            )}
                            <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-5">
                                <div className="flex items-center gap-3 text-xs text-fg-dim">
                                    {job && !active && (
                                        <button type="button" onClick={() => setView("run")} className="transition-colors hover:text-fg">
                                            Last run · {STATUS_LABEL[job.status] ?? job.status}
                                        </button>
                                    )}
                                    {!pinning && wikiWarnings.length === 0 && (
                                        <button type="button" onClick={() => setPinning(true)} className="transition-colors hover:text-fg">
                                            Wikipedia titles
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg">
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={start}
                                        disabled={starting}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
                                    >
                                        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        {hasChart ? "Rewrite with " : "Write with "}
                                        {GENERATOR_MODELS[model].label}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                                <span className="relative flex h-2.5 w-2.5">
                                    {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />}
                                    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? "bg-sky-400" : job.status === "done" ? "bg-emerald-400" : "bg-rose-400"}`} />
                                </span>
                                <DialogTitle className="font-display text-base font-semibold text-fg">{STATUS_LABEL[job.status] ?? job.status}</DialogTitle>
                                <DialogDescription className="sr-only">The run&apos;s console</DialogDescription>
                                <span className="ml-auto font-mono text-xs tabular-nums text-fg-dim">{clock(elapsed)}</span>
                                <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg" aria-label="Close">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <ol className="max-h-72 space-y-1 overflow-y-auto bg-surface-1 px-5 py-4 font-mono text-xs">
                                {job.log.map((entry, i) => {
                                    const last = i === job.log.length - 1;
                                    const live = last && active;
                                    const failedLine = last && job.status === "failed";
                                    return (
                                        <li key={i} className={`flex items-start gap-3 ${live ? "text-fg" : failedLine ? "text-rose-400" : "text-fg-muted"}`}>
                                            <span className="w-9 shrink-0 tabular-nums text-fg-faint">{clock(new Date(entry.t).getTime() - started)}</span>
                                            <span className="mt-0.5 w-3.5 shrink-0">
                                                {live ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                                                ) : failedLine ? (
                                                    <X className="h-3.5 w-3.5" />
                                                ) : (
                                                    <Check className="h-3.5 w-3.5 text-emerald-400/80" />
                                                )}
                                            </span>
                                            <span className="min-w-0 break-words">{entry.step}</span>
                                        </li>
                                    );
                                })}
                                {job.log.length === 0 && (
                                    <li className="flex items-center gap-3 text-fg-muted">
                                        <span className="w-9 text-fg-faint">0:00</span>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" />
                                        <span>{job.step || "Starting"}</span>
                                    </li>
                                )}
                                <div ref={consoleEnd} />
                            </ol>

                            {job.status === "done" && (
                                <div className="space-y-3 border-t border-line px-5 py-4">
                                    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                                        <Stat value={job.peopleCount ?? "—"} label="people" />
                                        <Stat value={job.linkCount ?? "—"} label="links" />
                                        {cost && <Stat value={cost} label={job.model?.replace(/^claude-/, "") ?? ""} />}
                                        <Stat value={clock(elapsed)} label="min" />
                                    </div>
                                    {job.warnings.length > 0 && (
                                        <ul className="space-y-1 text-xs text-amber-400/90">
                                            {job.warnings.map((w, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                                    <span>{w}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button type="button" onClick={() => setView("choose")} className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg">
                                            Run again
                                        </button>
                                        <button type="button" onClick={() => setOpen(false)} className="rounded-full bg-surface-3 px-4 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-4">
                                            See the chart
                                        </button>
                                    </div>
                                </div>
                            )}
                            {job.status === "failed" && (
                                <div className="space-y-3 border-t border-line px-5 py-4">
                                    <p className="flex gap-2 text-sm text-rose-400">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>{job.error ?? "The run failed."}</span>
                                    </p>
                                    <div className="flex items-center justify-end gap-2">
                                        <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg">
                                            Close
                                        </button>
                                        <button type="button" onClick={() => setView("choose")} className="rounded-full bg-surface-3 px-4 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-4">
                                            Try again
                                        </button>
                                    </div>
                                </div>
                            )}
                            {active && (
                                <p className="border-t border-line px-5 py-3 text-xs text-fg-dim">
                                    Runs on the server — closing this keeps it going. The page refreshes when the chart lands.
                                </p>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Stat({ value, label }: { value: string | number; label: string }) {
    return (
        <span className="flex items-baseline gap-1">
            <span className="font-display text-xl font-semibold text-fg">{value}</span>
            <span className="text-xs text-fg-dim">{label}</span>
        </span>
    );
}
