"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, Check, X, Zap, Gem, Pencil, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { JobView } from "@/lib/character-map-jobs";
import type { Preflight } from "@/app/api/admin/character-maps/preflight/route";
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
 * Stills come from asianwiki, which only a browser may read: the page asks
 * the extension (`trackr:chart` on window, with the MDL slug) when a run
 * lands and on load for a chart with none yet, and hears back through
 * `trackr:stills`. Without the extension nothing is asked, and nothing lost
 * — the chart shows the MDL headshots.
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

/** What the extension reported about the stills for this chart. */
type StillsState = { status: "started" } | { status: "done"; page: string; matched: number; people: number; unmatched: string[] } | { status: "failed"; error: string; seen?: string[] } | { status: "skipped"; reason: string };

function askForStills(mdlSlug: string, force = false, page?: string) {
    window.dispatchEvent(new CustomEvent("trackr:chart", { detail: JSON.stringify({ mdlSlug, force, page }) }));
}

function clock(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function CharacterMapGenerateButton({ mdlSlug, hasChart, initialJob, needsStills = false }: { mdlSlug: string; hasChart: boolean; initialJob: JobView | null; needsStills?: boolean }) {
    const [job, setJob] = useState<JobView | null>(initialJob);
    const [stills, setStills] = useState<StillsState | null>(null);
    // The asianwiki page given by hand when the search has no exact title
    const [stillsPage, setStillsPage] = useState("");
    const [open, setOpen] = useState(false);
    // "choose" is the model panel; "run" the console for `job`
    const [view, setView] = useState<"choose" | "run">(initialJob && ACTIVE.has(initialJob.status) ? "run" : "choose");
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [model, setModel] = useState<GeneratorModel>(DEFAULT_GENERATOR_MODEL);
    // What the run would read, checked before it costs anything; the titles
    // given by hand when the search found nothing or the wrong article
    const [titles, setTitles] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState<Set<string>>(new Set());
    const [preflight, setPreflight] = useState<Preflight | null>(null);
    const [checking, setChecking] = useState(false);
    const [checkError, setCheckError] = useState<string | null>(null);
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
                    if (next.status === "done") {
                        router.refresh();
                        // a fresh chart has no stills; the extension, if there, dresses it now
                        setStills(null);
                        askForStills(mdlSlug, true);
                    }
                }
            } catch {
                // a missed poll is fine; the next one catches up
            }
        }, 2000);
        return () => clearInterval(timer);
    }, [active, job, router, mdlSlug]);

    // Hear the extension about the stills; on load, ask for a chart that has
    // none. The extension announces itself when its script lands and answers
    // a ping — whichever of the two mounted second still meets the other.
    useEffect(() => {
        let asked = false;
        const onExtension = () => {
            if (asked || !needsStills) return;
            asked = true;
            askForStills(mdlSlug);
        };
        const onStills = (e: Event) => {
            let detail: (StillsState & { mdlSlug?: string }) | null = null;
            try {
                const raw = (e as CustomEvent).detail;
                detail = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {
                return;
            }
            if (!detail || detail.mdlSlug !== mdlSlug) return;
            setStills(detail);
            if (detail.status === "done") router.refresh();
        };
        window.addEventListener("trackr:stills", onStills);
        window.addEventListener("trackr:extension", onExtension);
        window.dispatchEvent(new CustomEvent("trackr:ping"));
        return () => {
            window.removeEventListener("trackr:stills", onStills);
            window.removeEventListener("trackr:extension", onExtension);
        };
    }, [mdlSlug, needsStills, router]);

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

    // Check the sources whenever the choice is on screen and a title changes
    // — a moment after the last keystroke, so typing does not hammer Wikipedia
    const titlesKey = JSON.stringify(titles);
    useEffect(() => {
        if (!open || view !== "choose") return;
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setChecking(true);
            setCheckError(null);
            try {
                const res = await fetch("/api/admin/character-maps/preflight", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ mdlSlug, titles: JSON.parse(titlesKey) }),
                    signal: controller.signal,
                });
                const data = (await res.json().catch(() => ({}))) as { preflight?: Preflight; error?: string };
                if (!res.ok || !data.preflight) setCheckError(data.error ?? `HTTP ${res.status}`);
                else setPreflight(data.preflight);
            } catch (e) {
                if (!(e instanceof DOMException && e.name === "AbortError")) setCheckError(e instanceof Error ? e.message : "failed");
            } finally {
                if (!controller.signal.aborted) setChecking(false);
            }
        }, preflight ? 600 : 0);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, view, mdlSlug, titlesKey]);

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
    const sourcesOk = !!preflight && preflight.wiki.every((w) => w.found);

    const stillsLine = stills ? <StillsLine stills={stills} page={stillsPage} onPage={setStillsPage} onRetry={() => askForStills(mdlSlug, true, stillsPage)} /> : null;

    return (
        <div className="flex flex-col items-end gap-1.5">
            <button
                type="button"
                onClick={openPanel}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                title="Write the relationship chart with Claude (admin)"
            >
                {active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> : <Sparkles className="h-3.5 w-3.5" />}
                {label}
            </button>
            {/* The stills the extension fetched on its own, when the panel is not there to say so */}
            {!open && stillsLine}

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
                            <div className="mx-6 mt-4 rounded-lg border border-line bg-surface-1 px-3 py-2.5">
                                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-fg-dim">
                                    Sources
                                    {checking && <Loader2 className="h-3 w-3 animate-spin text-sky-400" />}
                                </div>
                                {checkError && !preflight ? (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-400">
                                        <AlertTriangle className="h-3 w-3" /> Could not check the sources: {checkError}
                                    </p>
                                ) : preflight ? (
                                    <ul className="mt-1.5 space-y-1 text-xs">
                                        <li className="flex items-center gap-2 text-fg-muted">
                                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                                            <span>
                                                MDL cast · {preflight.cast.main} main, {preflight.cast.support} support, {preflight.cast.guest} guest
                                                {preflight.synopsis ? " · synopsis" : ""}
                                            </span>
                                        </li>
                                        {preflight.wiki.map((w) => {
                                            const shown = editing.has(w.lang) || !w.found;
                                            // A section this short is a list of names — households, no sentences
                                            const thin = w.found && w.chars < 1000;
                                            return (
                                                <li key={w.lang} className="space-y-1">
                                                    <div className={`flex items-center gap-2 ${w.found ? "text-fg-muted" : "text-amber-400/90"}`}>
                                                        {w.found ? <Check className={`h-3.5 w-3.5 shrink-0 ${thin ? "text-fg-dim" : "text-emerald-400/80"}`} /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                                                        <span className="min-w-0 flex-1 truncate">
                                                            {w.lang}.wikipedia
                                                            {w.found ? (
                                                                <> · {w.title} · {thin ? `names only, ${(w.chars / 1000).toFixed(1)}K` : `${Math.round(w.chars / 1000)}K`} characters</>
                                                            ) : w.rejected ? (
                                                                <> · the search found &ldquo;{w.rejected}&rdquo;, which is not this drama</>
                                                            ) : w.title ? (
                                                                <> · &ldquo;{w.title}&rdquo; has no character section</>
                                                            ) : (
                                                                <> · no article found</>
                                                            )}
                                                        </span>
                                                        {w.found && !shown && (
                                                            <button type="button" onClick={() => setEditing((e) => new Set(e).add(w.lang))} className="text-fg-dim transition-colors hover:text-fg" title="Give another page title">
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {shown && (
                                                        <label className="ml-5 flex items-center gap-2 rounded-md bg-surface-2 px-2 py-1.5">
                                                            <span className="shrink-0 font-mono text-fg-dim">{w.lang}</span>
                                                            <input
                                                                value={titles[w.lang] ?? ""}
                                                                onChange={(e) => setTitles((t) => ({ ...t, [w.lang]: e.target.value }))}
                                                                placeholder="exact Wikipedia page title, e.g. 내일 (2022년 드라마)"
                                                                className="min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-faint"
                                                            />
                                                        </label>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="mt-1.5 text-xs text-fg-dim">Checking what the run would read…</p>
                                )}
                            </div>
                            {error && (
                                <p className="inline-flex items-center gap-1.5 px-6 pt-3 text-xs text-amber-400">
                                    <AlertTriangle className="h-3.5 w-3.5" /> {error}
                                </p>
                            )}
                            <div className="flex items-center justify-between gap-3 px-6 pb-6 pt-5">
                                <div className="text-xs text-fg-dim">
                                    {job && !active ? (
                                        <button type="button" onClick={() => setView("run")} className="transition-colors hover:text-fg">
                                            Last run · {STATUS_LABEL[job.status] ?? job.status}
                                        </button>
                                    ) : !sourcesOk && preflight ? (
                                        <span>Writes from what was found</span>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg">
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={start}
                                        disabled={starting || checking || (!preflight && !checkError)}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
                                        title={checking ? "Checking the sources" : undefined}
                                    >
                                        {starting || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
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
                                    {stillsLine}
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
        </div>
    );
}

/**
 * What the extension said about the stills — a spinner while it reads
 * asianwiki, the count that took, or why nothing did, with the field for
 * the page's exact name when the search had no title for it.
 */
function StillsLine({ stills, page, onPage, onRetry }: { stills: StillsState; page: string; onPage: (v: string) => void; onRetry: () => void }) {
    if (stills.status === "started") {
        return (
            <p className="flex items-center gap-2 text-xs text-fg-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> Fetching the stills from asianwiki…
            </p>
        );
    }
    if (stills.status === "done") {
        return (
            <p className="flex items-center gap-2 text-xs text-fg-muted">
                <ImageIcon className="h-3.5 w-3.5 text-emerald-400/80" />
                <span>
                    {stills.matched}/{stills.people} faces from asianwiki · {stills.page}
                    {stills.unmatched.length > 0 && <span className="text-fg-dim"> · missing {stills.unmatched.join(", ")}</span>}
                </span>
            </p>
        );
    }
    if (stills.status === "skipped") {
        return <p className="text-xs text-fg-dim">Stills: {stills.reason}</p>;
    }
    if (stills.status === "failed") {
        return (
            <div className="flex flex-col items-end gap-1.5 text-xs">
                <p className="flex items-center gap-2 text-amber-400/90">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span>
                        Stills: {stills.error}
                        {stills.seen?.length ? <span className="text-fg-dim"> · search saw {stills.seen.slice(0, 3).join(" · ")}</span> : null}
                    </span>
                </p>
                <form
                    className="flex items-center gap-1.5"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (page.trim()) onRetry();
                    }}
                >
                    <input
                        value={page}
                        onChange={(e) => onPage(e.target.value)}
                        placeholder="asianwiki page, e.g. Run On (Korean Drama)"
                        className="w-64 rounded-md bg-surface-2 px-2 py-1 text-fg outline-none placeholder:text-fg-faint"
                    />
                    <button type="submit" disabled={!page.trim()} className="rounded-full bg-surface-3 px-2.5 py-1 font-medium text-fg transition-colors hover:bg-surface-4 disabled:opacity-50">
                        Fetch
                    </button>
                </form>
            </div>
        );
    }
    return null;
}

function Stat({ value, label }: { value: string | number; label: string }) {
    return (
        <span className="flex items-baseline gap-1">
            <span className="font-display text-xl font-semibold text-fg">{value}</span>
            <span className="text-xs text-fg-dim">{label}</span>
        </span>
    );
}
