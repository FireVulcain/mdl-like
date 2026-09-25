"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertTriangle, Check, X, Zap, Gem, Pencil, Image as ImageIcon, BookOpen, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { JobView } from "@/lib/character-map-jobs";
import type { Preflight } from "@/app/api/admin/character-maps/preflight/route";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";
import { editLinkHref, sortWarnings } from "@/lib/character-map-warnings";

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
 * The episode recaps go the same way: the recap sites turn servers away too,
 * so when the box is ticked the page asks the extension (`trackr:recaps-ask`)
 * to read them and post them to the app, and hears back on `trackr:recaps`;
 * without the extension they can be pasted as JSON. Which sites are
 * offered is the preflight's call, by country — Dramabeans and
 * TheReviewGeek for a K-drama, CPOPHome for a C-drama; a K-drama's run
 * reads the one or the two ticked. Each site is read, kept and reported on
 * its own. A run with recaps dates its links by episode, which is what the
 * chart's "By episode" view shows.
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

// Roughly what a chart costs on each model, from the runs of September 2026:
// 5–50K in, 20–50K out, three quarters of the output thinking
const MODEL_HINT: Record<GeneratorModel, { icon: typeof Zap; blurb: string; cost: string }> = {
    sonnet: { icon: Zap, blurb: "Disciplined extraction at a fraction of the price. Right for most dramas.", cost: "about 20¢ a chart, 50¢ with recaps" },
    opus: { icon: Gem, blurb: "Holds the rules over a long input. For the big Chinese casts and long articles.", cost: "about 40¢ a chart, $1 with recaps" },
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

/**
 * What the extension reported about the recaps: reading, kept, or why not.
 * `tag` is where it found them (a Dramabeans tag, a CPOPHome page);
 * `needsTab` is a page the reader must open and keep open — CPOPHome's
 * Cloudflare wants a human to tick its box, and the extension then reads
 * through that tab.
 */
type RecapsState = { status: "started"; read?: number; of?: number } | { status: "done"; count: number; fromEp: number; toEp: number; words: number; tag?: string; listed?: string; skipped?: string } | { status: "failed"; error: string; seen?: string[]; needsTab?: string };

/** The recap sites' states, by site id. */
type RecapsBySource = Record<string, RecapsState>;

/** What the extension needs to find the drama on its site: the preflight's drama block, and a hint given by hand. */
type RecapAsk = Pick<Preflight["drama"], "year" | "episodes" | "akas" | "episodeOffset"> & { source: string; title: string; hint?: string };

// What the field under a site's checkbox takes when its search misses the drama
const HINT_PLACEHOLDER: Record<string, (title: string) => string> = {
    dramabeans: (title) => `Dramabeans tag or a recap's URL, if not "${title}"`,
    thereviewgeek: (title) => `Another title, or a recap's URL on TheReviewGeek, if not "${title}"`,
    cpophome: (title) => `The drama's CPOPHome URL, if the search misses "${title}"`,
};

function askForRecaps(mdlSlug: string, ask: RecapAsk) {
    window.dispatchEvent(new CustomEvent("trackr:recaps-ask", { detail: JSON.stringify({ mdlSlug, ...ask }) }));
}

/** One pasted recap, as the console snippet in the README writes them. */
type PastedRecap = { title?: string; url?: string; from?: number; to?: number; text?: string };

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
    // bumped when the kept recaps change, so the sources are read again
    const [sourcesTick, setSourcesTick] = useState(0);
    // the recap sites ticked, and each one's hint and read state
    const [picked, setPicked] = useState<string[]>([]);
    const [recapsHint, setRecapsHint] = useState<Record<string, string>>({});
    const [recaps, setRecaps] = useState<RecapsBySource>({});
    const [extension, setExtension] = useState(false);
    // the site whose recaps are being pasted, if any
    const [pasting, setPasting] = useState<string | null>(null);
    const [pasted, setPasted] = useState("");
    const [pasteError, setPasteError] = useState<string | null>(null);
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
            setExtension(true);
            if (asked || !needsStills) return;
            asked = true;
            askForStills(mdlSlug);
        };
        const onRecaps = (e: Event) => {
            let detail: (RecapsState & { mdlSlug?: string; source?: string }) | null = null;
            try {
                const raw = (e as CustomEvent).detail;
                detail = typeof raw === "string" ? JSON.parse(raw) : raw;
            } catch {
                return;
            }
            if (!detail || detail.mdlSlug !== mdlSlug) return;
            // an older extension does not name the site; it only read Dramabeans or CPOPHome
            const source = detail.source ?? "dramabeans";
            setRecaps((r) => ({ ...r, [source]: detail }));
            if (detail.status === "done") setSourcesTick((t) => t + 1);
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
        window.addEventListener("trackr:recaps", onRecaps);
        window.addEventListener("trackr:extension", onExtension);
        window.dispatchEvent(new CustomEvent("trackr:ping"));
        return () => {
            window.removeEventListener("trackr:stills", onStills);
            window.removeEventListener("trackr:recaps", onRecaps);
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
    // the plan depends on the recap sites ticked
    const pickedKey = picked.join(",");
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
                    body: JSON.stringify({ mdlSlug, titles: JSON.parse(titlesKey), sources: pickedKey ? pickedKey.split(",") : [] }),
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
    }, [open, view, mdlSlug, titlesKey, pickedKey, sourcesTick]);

    // The drama's title on the recap sites is MDL's, without the year
    const dramaTitle = preflight?.title.replace(/ [(][0-9]{4}[)]$/, "") ?? "";
    const recapsKept = preflight?.recaps ?? {};
    // Where this drama's recaps can be read, by its country; empty when no site covers it
    const recapSources = preflight?.drama.sources ?? [];
    const ask = (source: string) => {
        if (!preflight || !dramaTitle) return;
        const { year, episodes, akas, episodeOffset } = preflight.drama;
        askForRecaps(mdlSlug, { source, title: dramaTitle, year, episodes, akas, episodeOffset, hint: recapsHint[source]?.trim() || undefined });
    };

    // Ticking a site reads its recaps when none are kept; a set already kept is used as it is
    function tickRecaps(source: string, on: boolean) {
        setPicked((p) => (on ? [...p.filter((s) => s !== source), source] : p.filter((s) => s !== source)));
        if (on && !recapsKept[source] && extension && recaps[source]?.status !== "started") ask(source);
    }

    // The paste fallback: the JSON array the README's console snippets write, for the site being pasted
    async function savePasted() {
        const source = pasting;
        if (!source) return;
        setPasteError(null);
        let list: PastedRecap[];
        try {
            const parsed = JSON.parse(pasted) as unknown;
            list = Array.isArray(parsed) ? (parsed as PastedRecap[]) : [];
        } catch {
            setPasteError("That is not JSON");
            return;
        }
        const ok = list.filter((r) => r && typeof r.text === "string" && r.text.trim() && Number.isInteger(r.from));
        if (ok.length === 0) {
            setPasteError("No recap in there — each needs a `from` episode and a `text`");
            return;
        }
        const report = (state: RecapsState) => setRecaps((r) => ({ ...r, [source]: state }));
        report({ status: "started" });
        try {
            const res = await fetch("/api/ext/character-maps/recaps", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mdlSlug, source, recaps: ok.map((r) => ({ title: r.title, url: r.url, from: r.from, to: r.to, text: r.text })) }),
            });
            const data = (await res.json().catch(() => ({}))) as { summary?: { count: number; fromEp: number; toEp: number; words: number } | null; error?: string };
            if (!res.ok || !data.summary) {
                report({ status: "failed", error: data.error ?? `HTTP ${res.status}` });
                return;
            }
            report({ status: "done", ...data.summary });
            setPasting(null);
            setPasted("");
            setSourcesTick((t) => t + 1);
        } catch (e) {
            report({ status: "failed", error: e instanceof Error ? e.message : "failed" });
        }
    }

    async function start(mode: "full" | "continue" = "full") {
        setStarting(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/character-maps/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mdlSlug, model, titles, recaps: picked.filter((id) => recapsKept[id]), mode }),
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
    // What the panel offers: carrying the chart forward over the episodes it
    // has not read, when the preflight found some, or writing it again.
    const plan = preflight?.plan ?? null;
    const canContinue = plan?.mode === "continue";
    const label = active ? "Generating…" : canContinue ? "Update chart" : hasChart ? "Regenerate chart" : "Generate chart";
    const sourcesOk = !!preflight && preflight.wiki.every((w) => w.found);
    // With a site ticked, the run waits for its recaps to be kept
    const recapsPending = picked.some((id) => !recapsKept[id]);

    const stillsLine = stills ? <StillsLine stills={stills} page={stillsPage} onPage={setStillsPage} onRetry={() => askForStills(mdlSlug, true, stillsPage)} /> : null;

    return (
        <div className="flex flex-col items-end gap-1.5">
            <button
                type="button"
                onClick={openPanel}
                className="inline-flex items-center gap-1.5 text-[13px] text-fg-dim transition-colors hover:text-fg cursor-pointer"
                title="Write the relationship chart with Claude (admin)"
            >
                {active && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {label}
            </button>
            {/* The stills the extension fetched on its own, when the panel is not there to say so */}
            {!open && stillsLine}

            <Dialog open={open} onOpenChange={setOpen}>
                {/* The content is a grid; its rows must be allowed to shrink (min-w-0), or a long
                    nowrap line in the sources (a rejected article's title) widens every row past the box */}
                <DialogContent showCloseButton={false} className="gap-0 border-line-strong bg-panel p-0 sm:max-w-lg [&>*]:min-w-0">
                    {view === "choose" || !job ? (
                        <>
                            <DialogHeader className="px-6 pt-6">
                                <DialogTitle className="font-display text-lg font-semibold text-fg">{hasChart ? "Rewrite the relationship chart" : "Write the relationship chart"}</DialogTitle>
                                <DialogDescription className="text-sm text-fg-muted">
                                    Claude reads the MDL cast, the synopsis and the Wikipedia character sections, and writes the chart with the sentence behind every link.
                                    {hasChart && (
                                        <span className="block pt-1 text-fg-dim">
                                            {canContinue ? "The chart is kept and the new episodes are folded into it." : "The current chart is replaced when the run lands."}
                                        </span>
                                    )}
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
                                {/* What this run would do, before anything is spent: a chart
                                    that has read to episode N and has recaps past it is carried
                                    forward instead of written again, which keeps the stills, the
                                    asianwiki pin and every link corrected by hand. */}
                                {plan && plan.mode !== "full" && (
                                    <div className={`mb-4 rounded-lg border px-3 py-2.5 text-xs ${canContinue ? "border-sky-500/30 bg-sky-500/5" : "border-line bg-surface-2"}`}>
                                        <div className="flex items-center gap-1.5 font-medium text-fg">
                                            <BookOpen className="h-3.5 w-3.5 text-sky-400" />
                                            {canContinue ? "New episodes to add" : "Nothing new to read"}
                                        </div>
                                        <p className="mt-1 text-fg-muted">
                                            The chart reads to episode {plan.coveredTo}.{" "}
                                            {canContinue
                                                ? `Episode${plan.freshFrom === plan.freshTo ? ` ${plan.freshFrom}` : `s ${plan.freshFrom}–${plan.freshTo}`} are kept but not in it yet.`
                                                : "Every recap kept for this entry is already in it."}
                                        </p>
                                        {canContinue && (
                                            <p className="mt-1 text-fg-dim">
                                                Continuing reads only those, and changes only what they say — the stills, the asianwiki page and any link you
                                                corrected by hand are kept.
                                                {plan.undigested > 0 && ` This first one also reads the ${plan.undigested} earlier recaps once, to summarise them; later updates will not.`}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {preflight?.editedAt && (
                                    <p className="mb-4 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-400/90">
                                        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            You edited this chart by hand on {new Date(preflight.editedAt).toLocaleDateString()}. Rewriting it replaces every
                                            link and throws those edits away{canContinue ? " — continuing keeps them." : "."}
                                        </span>
                                    </p>
                                )}
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
                                                    <div className={`flex items-start gap-2 ${w.found ? "text-fg-muted" : "text-amber-400/90"}`}>
                                                        {w.found ? <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${thin ? "text-fg-dim" : "text-emerald-400/80"}`} /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                                                        <span className="min-w-0 flex-1 break-words">
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
                                                                placeholder="the article's URL, or its exact title — 내일 (2022년 드라마)"
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
                                {preflight && recapSources.length === 0 && (
                                    <p className="mt-2 border-t border-line pt-2 text-xs text-fg-dim">
                                        No recap site for a drama from {preflight.drama.country || "there"} — Dramabeans and TheReviewGeek cover Korean dramas, CPOPHome Chinese ones. The chart is written undated.
                                    </p>
                                )}
                                {preflight && recapSources.length > 0 && (
                                    <div className="mt-2 space-y-2 border-t border-line pt-2 text-xs">
                                        {recapSources.length > 1 && <p className="text-fg-dim">Episode recaps date every link, for the chart&apos;s &ldquo;By episode&rdquo; view — read one site or both.</p>}
                                        {recapSources.map((src) => {
                                            const kept = recapsKept[src.id] ?? null;
                                            const state = recaps[src.id] ?? null;
                                            const on = picked.includes(src.id);
                                            return (
                                                <div key={src.id}>
                                                    <label className="flex cursor-pointer items-center gap-2 text-fg-muted">
                                                        <input type="checkbox" checked={on} onChange={(e) => tickRecaps(src.id, e.target.checked)} className="h-3.5 w-3.5 accent-sky-500" />
                                                        <span>
                                                            Also read the {src.name} recaps
                                                            {recapSources.length === 1 ? (
                                                                <span className="text-fg-dim"> · every link dated by episode, for the chart&apos;s &ldquo;By episode&rdquo; view</span>
                                                            ) : kept && !on ? (
                                                                <span className="text-fg-dim"> · {kept.count} kept, ep {kept.fromEp}–{kept.toEp}</span>
                                                            ) : null}
                                                        </span>
                                                    </label>
                                                    {on && (
                                                        <div className="ml-5 mt-1.5 space-y-1.5">
                                                            {preflight.drama.episodeOffset > 0 && (
                                                                <p className="text-fg-dim">
                                                                    A part of a split airing: {src.name}&apos;s recaps {preflight.drama.episodeOffset + 1}–{preflight.drama.episodeOffset + (preflight.drama.episodes ?? 0)} are read as episodes 1–{preflight.drama.episodes ?? "…"} here.
                                                                </p>
                                                            )}
                                                            {state?.status === "started" ? (
                                                                <p className="flex items-center gap-2 text-fg-muted">
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" /> Reading the recaps on {src.name}…
                                                                    {state.of ? <span className="text-fg-dim">{state.read ?? 0}/{state.of}</span> : null}
                                                                </p>
                                                            ) : (
                                                                <>
                                                                    {kept && (
                                                                        <p className="flex items-start gap-2 text-fg-muted">
                                                                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                                                                            <span className="min-w-0 flex-1 break-words">
                                                                                {kept.source} · {kept.count} recap{kept.count > 1 ? "s" : ""} · ep {kept.fromEp}–{kept.toEp} · {Math.round(kept.words / 1000)}K words
                                                                                {state?.status === "done" && state.tag && <span className="text-fg-dim"> · &ldquo;{state.tag}&rdquo;</span>}
                                                                                {state?.status === "done" && state.listed && <span className="text-fg-dim"> · site lists {state.listed}</span>}
                                                                                {state?.status === "done" && state.skipped && <span className="text-amber-400/80"> · not read: {state.skipped}</span>}
                                                                            </span>
                                                                            {extension && dramaTitle && (
                                                                                <button type="button" onClick={() => ask(src.id)} className="text-fg-dim transition-colors hover:text-fg" title="Read them again — new episodes since">
                                                                                    <RefreshCw className="h-3 w-3" />
                                                                                </button>
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                    {state?.status === "failed" && (
                                                                        <p className="flex items-start gap-1.5 text-amber-400/90">
                                                                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                                                            <span>
                                                                                {state.error}
                                                                                {state.seen?.length ? <span className="text-fg-dim"> · seen: {state.seen.slice(0, 4).join(" · ")}</span> : null}
                                                                                {state.needsTab && (
                                                                                    <>
                                                                                        {" "}
                                                                                        <a href={state.needsTab} target="_blank" rel="noreferrer" className="text-fg-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg">
                                                                                            Open it
                                                                                        </a>
                                                                                        , pass the check, keep that tab open, then Read again.
                                                                                    </>
                                                                                )}
                                                                            </span>
                                                                        </p>
                                                                    )}
                                                                    {kept && state?.status !== "failed" ? null : extension ? (
                                                                        <form
                                                                            className="flex items-center gap-1.5"
                                                                            onSubmit={(e) => {
                                                                                e.preventDefault();
                                                                                ask(src.id);
                                                                            }}
                                                                        >
                                                                            <input
                                                                                value={recapsHint[src.id] ?? ""}
                                                                                onChange={(e) => setRecapsHint((h) => ({ ...h, [src.id]: e.target.value }))}
                                                                                placeholder={HINT_PLACEHOLDER[src.id]?.(dramaTitle) ?? `A URL on ${src.name}, if the search misses "${dramaTitle}"`}
                                                                                className="min-w-0 flex-1 rounded-md bg-surface-2 px-2 py-1 text-fg outline-none placeholder:text-fg-faint"
                                                                            />
                                                                            <button type="submit" className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 font-medium text-fg transition-colors hover:bg-surface-4">
                                                                                <BookOpen className="h-3 w-3" /> Read
                                                                            </button>
                                                                        </form>
                                                                    ) : pasting !== src.id ? (
                                                                        <p className="text-fg-dim">
                                                                            {src.name} turns servers away; the extension reads the recaps from this browser.{" "}
                                                                            <button type="button" onClick={() => setPasting(src.id)} className="text-fg-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg">
                                                                                Paste them instead
                                                                            </button>
                                                                        </p>
                                                                    ) : null}
                                                                    {pasting === src.id && !kept && (
                                                                        <div className="space-y-1.5">
                                                                            <textarea
                                                                                value={pasted}
                                                                                onChange={(e) => setPasted(e.target.value)}
                                                                                placeholder={'[{ "title": "…: Episode 1", "from": 1, "to": 1, "text": "…" }, …] — the README has the console snippet that writes this'}
                                                                                rows={4}
                                                                                className="w-full rounded-md bg-surface-2 px-2 py-1.5 font-mono text-[11px] text-fg outline-none placeholder:text-fg-faint"
                                                                            />
                                                                            {pasteError && <p className="text-amber-400/90">{pasteError}</p>}
                                                                            <div className="flex items-center gap-2">
                                                                                <button type="button" onClick={savePasted} disabled={!pasted.trim()} className="rounded-full bg-surface-3 px-2.5 py-1 font-medium text-fg transition-colors hover:bg-surface-4 disabled:opacity-50">
                                                                                    Keep these recaps
                                                                                </button>
                                                                                <button type="button" onClick={() => setPasting(null)} className="text-fg-dim transition-colors hover:text-fg">
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
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
                                    {/* With new episodes to add, carrying on is the action and
                                        rewriting steps back to a quiet one: it costs more and
                                        throws the hand-written links away. */}
                                    {canContinue && (
                                        <button
                                            type="button"
                                            onClick={() => start("full")}
                                            disabled={starting || checking || recapsPending}
                                            className="rounded-full px-3 py-1.5 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-60"
                                        >
                                            Rewrite instead
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => start(canContinue ? "continue" : "full")}
                                        disabled={starting || checking || (!preflight && !checkError) || recapsPending}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-60"
                                        title={checking ? "Checking the sources" : recapsPending ? "Waiting for the recaps" : undefined}
                                    >
                                        {starting || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        {canContinue ? "Continue with " : hasChart ? "Rewrite with " : "Write with "}
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
                                    {job.warnings.length > 0 && <RunWarnings warnings={job.warnings} />}
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

/**
 * What the run's checks said, in two piles: what is left to look at, each
 * line that names a link opening it in the relationships editor, and —
 * folded away — what the checks already put right. One list of fifteen
 * amber lines once hid the only one that mattered: a husband drawn as his
 * wife's wife, said as a density note.
 */
function RunWarnings({ warnings }: { warnings: string[] }) {
    const { fixed, check } = sortWarnings(warnings);
    return (
        <div className="space-y-2 text-xs">
            {check.length > 0 && (
                <div className="space-y-1">
                    <p className="font-medium text-amber-400">To check · {check.length}</p>
                    <ul className="space-y-1 text-amber-400/90">
                        {check.map((w, i) => (
                            <li key={i} className="flex gap-2">
                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="min-w-0 flex-1 wrap-break-word">{w.text}</span>
                                {w.link && (
                                    <a
                                        href={editLinkHref(window.location, w.link)}
                                        className="shrink-0 text-fg-muted underline decoration-line-strong underline-offset-2 transition-colors hover:text-fg"
                                        title="Open this link in the relationships editor"
                                    >
                                        Open
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {fixed.length > 0 && (
                <details className="group">
                    <summary className="cursor-pointer list-none text-fg-dim transition-colors hover:text-fg-muted">
                        <Check className="mr-1 inline h-3 w-3 text-emerald-400/80" />
                        Fixed by the checks · {fixed.length}
                        <span className="group-open:hidden"> — show</span>
                    </summary>
                    <ul className="mt-1 space-y-1 text-fg-dim">
                        {fixed.map((w, i) => (
                            <li key={i} className="wrap-break-word pl-4">
                                {w.text}
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </div>
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
