"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { fetchScraperCalls } from "@/actions/scraper-dashboard";
import type { ScraperCallGroup, ScraperCallRow, ScraperOverview, ScraperPeriod } from "@/lib/scraper-stats";

/**
 * /admin/scraper: every call the app made to the MDL scraper, who made it, and
 * what the cache answered instead. The overview arrives folded from the
 * server; the console below reads its own pages through a server action.
 */

const TRIGGERS: Record<string, { label: string; color: string; hint: string }> = {
    render: { label: "Page render", color: "#3987e5", hint: "a page being drawn" },
    prefetch: { label: "Prefetch", color: "#d95926", hint: "Next preloading a link" },
    action: { label: "Action", color: "#199e70", hint: "live refresh, Refresh cache, a button" },
    background: { label: "Background", color: "#d55181", hint: "work queued after a response" },
    cron: { label: "Cron", color: "#c98500", hint: "the scheduled jobs" },
    api: { label: "API route", color: "#8b7fe0", hint: "tag search, the extension" },
    script: { label: "Script", color: "#7d8695", hint: "outside any request" },
};
const PAGE_COLORS = ["#3987e5", "#d95926", "#199e70", "#d55181", "#6b7280"];
const ROUTES: Record<string, string> = {
    details: "Details", cast: "Cast", ratings: "Ratings", episodes: "Episode list", episode: "Episode", reviews: "Reviews",
    threads: "Comments", photos: "Photos", recs: "Recommendations", top: "Top list", person: "Person", "person-extra": "Person extras",
    search: "Search", tags: "Tag search", dramalist: "User list", other: "Other",
};
const PAGE_NAMES: Record<string, string> = {
    "/": "Home", "/media/[id]": "Drama page", "/media/[id]/episodes": "Episodes", "/media/[id]/episode/[episodeNumber]": "Episode",
    "/media/[id]/cast": "Full cast", "/media/[id]/photos": "Photos", "/media/[id]/reviews": "Reviews", "/people/[slug]": "Person page",
    "/people/together": "Worked together", "/dramas": "Browse", "/search": "Search", "/watchlist": "Watchlist", "/calendar": "Calendar",
    "/api/cron/sync": "Watchlist sync", "/api/cron/airing": "Airing now", "/api/cron/history": "Finished shows", "—": "No request",
};
const PERIODS: { value: ScraperPeriod; label: string }[] = [
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
    { value: "30d", label: "30 days" },
];

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number) => nf.format(n);
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const pageName = (p: string | null) => (p ? PAGE_NAMES[p] ?? p : "—");
const triggerOf = (t: string) => TRIGGERS[t] ?? { label: t, color: "#7d8695", hint: "" };
const isFail = (s: number) => s >= 400 || s === 0;
const statusLabel = (s: number) => (s === 0 ? "timeout" : String(s));
const prettyTarget = (t: string | null) => (t ? t.replace(/^\d+-/, "").replace(/-/g, " ") : "—");
/** The title the scraper answered with, or the slug made readable when there is none. */
function about(c: Pick<ScraperCallRow, "route" | "target" | "label">): string {
    if (c.route === "top") return `${c.target === "all" ? "All countries" : (c.target ?? "").replace(/,/g, ", ")} top list`;
    if (c.route === "search") return `“${decodeURIComponent(c.target ?? "")}”`;
    return c.label ?? prettyTarget(c.target);
}
/** What a group of calls was mostly about: the label most of its calls share. */
function subjectOf(calls: ScraperCallRow[]): string | null {
    const counts = new Map<string, number>();
    for (const c of calls) if (c.label && c.route !== "top") counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
    let best: string | null = null, n = 0;
    for (const [k, v] of counts) if (v > n) { best = k; n = v; }
    return n > 1 || calls.length === 1 ? best : null;
}

function useClock(period: ScraperPeriod) {
    return useMemo(() => {
        const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
        const seconds = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
        const tick = (iso: string) => (period === "24h" ? time.format(new Date(iso)) : `${day.format(new Date(iso))} ${time.format(new Date(iso))}`);
        const at = (iso: string) => (period === "24h" ? seconds.format(new Date(iso)) : `${day.format(new Date(iso))} ${seconds.format(new Date(iso))}`);
        return { tick, at, axis: (iso: string) => (period === "30d" ? day.format(new Date(iso)) : time.format(new Date(iso))) };
    }, [period]);
}

function Rail<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
    return (
        <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    aria-pressed={o.value === value}
                    onClick={() => onChange(o.value)}
                    className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${o.value === value ? "bg-surface-4 text-fg" : "text-fg-muted hover:text-fg"}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function Kpi({ value, label, sub, bar }: { value: string; label: string; sub?: string; bar?: { share: number; color: string } }) {
    return (
        <div className="min-w-0 rounded-lg bg-box p-4">
            <div className="font-mono text-[22px] font-medium leading-tight tracking-tight text-fg tabular-nums">{value}</div>
            <div className="mt-0.5 text-xs text-fg-dim">{label}</div>
            {bar && (
                <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full" style={{ width: `${Math.min(100, bar.share * 100)}%`, background: bar.color }} />
                </div>
            )}
            {sub && <div className="mt-1 text-xs text-fg-muted tabular-nums">{sub}</div>}
        </div>
    );
}

function Timeline({ overview, mode }: { overview: ScraperOverview; mode: "trigger" | "page" }) {
    const clock = useClock(overview.period);
    const box = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(900);
    const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
    useEffect(() => {
        const el = box.current;
        if (!el) return;
        const ro = new ResizeObserver(([e]) => setWidth(Math.max(560, Math.floor(e.contentRect.width))));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const keys = mode === "trigger"
        ? Object.keys(TRIGGERS).filter((k) => overview.timeline.some((b) => b.byTrigger[k]))
        : [...overview.topPages, "other"].filter((k) => overview.timeline.some((b) => b.byPage[k]));
    const color = (k: string) => (mode === "trigger" ? triggerOf(k).color : PAGE_COLORS[overview.topPages.indexOf(k)] ?? PAGE_COLORS[4]);
    const label = (k: string) => (mode === "trigger" ? triggerOf(k).label : k === "other" ? "Everything else" : pageName(k));
    const count = (b: ScraperOverview["timeline"][number], k: string) => (mode === "trigger" ? b.byTrigger[k] : b.byPage[k]) ?? 0;

    const B = overview.timeline;
    const max = Math.max(1, ...B.map((b) => keys.reduce((a, k) => a + count(b, k), 0)));
    const step = max <= 20 ? 5 : max <= 60 ? 15 : max <= 200 ? 50 : 100;
    const yMax = Math.ceil(max / step) * step;
    const H = 210, m = { t: 8, r: 4, b: 22, l: 34 }, iw = width - m.l - m.r, ih = H - m.t - m.b;
    const slot = iw / Math.max(1, B.length), bw = Math.max(1.5, slot - (slot > 6 ? 2 : 1));
    const y = (v: number) => m.t + ih - (v / yMax) * ih;
    const labelEvery = Math.max(1, Math.round(B.length / 8));

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                {keys.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: color(k) }} />
                        {label(k)}
                    </span>
                ))}
            </div>
            <div ref={box} className="relative overflow-x-auto" onMouseLeave={() => setHover(null)}>
                <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={`Calls to MDL per ${overview.bucketMs / 60000} minutes`}>
                    {[0, 0.5, 1].map((f) => (
                        <g key={f}>
                            <line x1={m.l} x2={width - m.r} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--line-soft)" />
                            <text x={m.l - 6} y={y(yMax * f) + 3} textAnchor="end" className="fill-fg-dim font-mono text-[10px]">{Math.round(yMax * f)}</text>
                        </g>
                    ))}
                    {B.map((b, i) => {
                        let acc = 0;
                        const x = m.l + i * slot + (slot - bw) / 2;
                        return (
                            <g key={b.t}>
                                {keys.map((k) => {
                                    const v = count(b, k);
                                    if (!v) return null;
                                    const y0 = y(acc), y1 = y(acc + v);
                                    acc += v;
                                    return <rect key={k} x={x} y={y1} width={bw} height={Math.max(1, y0 - y1 - (acc > v ? 1.5 : 0))} rx={1} fill={color(k)} />;
                                })}
                                {i % labelEvery === 0 && (
                                    <text x={m.l + i * slot} y={H - 6} className="fill-fg-dim font-mono text-[10px]">{clock.axis(b.t)}</text>
                                )}
                                <rect
                                    x={m.l + i * slot}
                                    y={m.t}
                                    width={slot}
                                    height={ih}
                                    fill="transparent"
                                    onMouseMove={(e) => {
                                        const r = box.current!.getBoundingClientRect();
                                        setHover({ i, x: e.clientX - r.left + box.current!.scrollLeft, y: e.clientY - r.top });
                                    }}
                                />
                            </g>
                        );
                    })}
                    <line x1={m.l} x2={width - m.r} y1={m.t + ih} y2={m.t + ih} stroke="var(--fg-faint)" />
                </svg>
                {hover && B[hover.i] && (
                    <div
                        className="pointer-events-none absolute z-10 min-w-44 rounded-lg bg-panel p-2.5 text-xs shadow-lg ring-1 ring-line"
                        style={{ left: Math.min(hover.x + 12, width - 190), top: Math.max(0, hover.y - 10) }}
                    >
                        <div className="mb-1 font-medium text-fg">
                            {clock.tick(B[hover.i].t)} · {keys.reduce((a, k) => a + count(B[hover.i], k), 0)} calls
                        </div>
                        {keys.filter((k) => count(B[hover.i], k)).map((k) => (
                            <div key={k} className="flex justify-between gap-3 text-fg-muted">
                                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: color(k) }} />{label(k)}</span>
                                <span className="tabular-nums">{count(B[hover.i], k)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CallRow({ c, at }: { c: ScraperCallRow; at: (iso: string) => string }) {
    const fail = isFail(c.status);
    return (
        <tr className={fail ? "shadow-[inset_2px_0_0_var(--color-dropped)]" : undefined}>
            <td className="py-1.5 pl-3 pr-3 font-mono tabular-nums text-fg-muted">{at(c.at)}</td>
            <td className="py-1.5 pr-3 text-fg-soft">{ROUTES[c.route] ?? c.route}</td>
            <td className="max-w-72 truncate py-1.5 pr-3 text-fg-soft" title={c.target ?? undefined}>{about(c)}</td>
            <td className="py-1.5 pr-3"><span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-fg-muted">{triggerOf(c.trigger).label}</span></td>
            <td className={`py-1.5 pr-3 text-right tabular-nums ${fail ? "font-semibold text-fg" : "text-fg-dim"}`}>{statusLabel(c.status)}</td>
            <td className="py-1.5 pr-3 text-right tabular-nums text-fg-dim">{fmt(c.durationMs)} ms</td>
        </tr>
    );
}

function Console({ overview }: { overview: ScraperOverview }) {
    const clock = useClock(overview.period);
    const [trigger, setTrigger] = useState("");
    const [page, setPage] = useState("");
    const [failedOnly, setFailedOnly] = useState(false);
    const [q, setQ] = useState("");
    const [query, setQuery] = useState("");
    const [grouped, setGrouped] = useState(true);
    const [groups, setGroups] = useState<ScraperCallGroup[]>([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [open, setOpen] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    useEffect(() => {
        const t = setTimeout(() => setQuery(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    const load = (offset: number) =>
        start(async () => {
            try {
                const res = await fetchScraperCalls({ period: overview.period, trigger: trigger || undefined, page: page || undefined, failedOnly, q: query || undefined, grouped, offset });
                setGroups((prev) => (offset ? [...prev, ...res.groups] : res.groups));
                setTotal(res.total);
                setHasMore(res.hasMore);
                setError(null);
            } catch {
                setError("Could not load the calls. Reload the page to try again.");
            }
        });

    useEffect(() => {
        load(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [overview.period, trigger, page, failedOnly, query, grouped]);

    const toggle = (k: string) => setOpen((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    const triggerOptions = [{ value: "", label: "All" }, ...overview.triggers.map((t) => ({ value: t.trigger, label: triggerOf(t.trigger).label }))];

    return (
        <div className="space-y-3 rounded-lg bg-box p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-fg">Calls</h2>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
                    <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} className="accent-sky-500" />
                    Group by page opening
                </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Rail value={trigger} options={triggerOptions} onChange={setTrigger} label="Trigger" />
                <select value={page} onChange={(e) => setPage(e.target.value)} aria-label="Page" className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg">
                    <option value="">All pages</option>
                    {overview.pages.filter((p) => p.calls).map((p) => (
                        <option key={p.page} value={p.page}>{pageName(p.page)} · {p.page}</option>
                    ))}
                </select>
                <select value={failedOnly ? "fail" : ""} onChange={(e) => setFailedOnly(e.target.value === "fail")} aria-label="Status" className="rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg">
                    <option value="">Any status</option>
                    <option value="fail">Failures only</option>
                </select>
                <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Title, person, slug…"
                    aria-label="Search by drama or person"
                    className="min-w-44 rounded-md bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg placeholder:text-fg-faint"
                />
            </div>
            <p className="text-xs text-fg-dim" aria-live="polite">
                {pending ? "Loading…" : error ?? `${fmt(total)} calls${grouped ? `, in ${groups.length}${hasMore ? "+" : ""} groups` : ""}`}
            </p>

            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
                    <thead>
                        <tr className="text-left text-xs text-fg-dim">
                            <th className="pb-2 pl-3 pr-3 font-normal">Time</th>
                            <th className="pb-2 pr-3 font-normal">Route</th>
                            <th className="pb-2 pr-3 font-normal">About</th>
                            <th className="pb-2 pr-3 font-normal">Trigger</th>
                            <th className="pb-2 pr-3 text-right font-normal">Status</th>
                            <th className="pb-2 pr-3 text-right font-normal">Time taken</th>
                        </tr>
                    </thead>
                    {groups.map((g) =>
                        g.kind === "single" ? (
                            <tbody key={g.key} className="border-t border-line-soft">
                                <CallRow c={g.calls[0]} at={clock.at} />
                            </tbody>
                        ) : (
                            <tbody key={g.key} className="border-t border-line-soft">
                                <tr className="cursor-pointer bg-surface-1 hover:bg-surface-2" onClick={() => toggle(g.key)}>
                                    <td className="py-2 pl-3 pr-3 font-mono tabular-nums text-fg-muted">{clock.at(g.last)}</td>
                                    <td colSpan={5} className="py-2 pr-3 text-fg-soft">
                                        <span className="mr-1.5 inline-block w-3 text-fg-dim">{open.has(g.key) ? "▾" : "▸"}</span>
                                        <span className="font-medium text-fg">{pageName(g.page)}</span>
                                        {subjectOf(g.calls) && <span className="text-fg"> · {subjectOf(g.calls)}</span>}
                                        {g.pagePath && g.pagePath !== g.page && <span className="ml-2 font-mono text-xs text-fg-dim">{g.pagePath}</span>}
                                        <span className="text-fg-dim"> · {g.calls.length} call{g.calls.length > 1 ? "s" : ""} · {triggerOf(g.trigger).label}{g.kind === "run" ? " run" : ""}</span>
                                        {g.failed > 0 && <span className="font-semibold text-fg"> · {g.failed} failed</span>}
                                        {g.userId && <span className="text-fg-dim"> · {g.userId === "mock-user-1" ? "dev" : "signed in"}</span>}
                                    </td>
                                </tr>
                                {open.has(g.key) && [...g.calls].reverse().map((c) => <CallRow key={c.id} c={c} at={clock.at} />)}
                            </tbody>
                        ),
                    )}
                </table>
            </div>
            {!pending && !error && groups.length === 0 && <p className="py-6 text-center text-[13px] text-fg-dim">No call matches these filters.</p>}
            {hasMore && (
                <div className="flex justify-center">
                    <button type="button" disabled={pending} onClick={() => load(groups.length)} className="rounded-md bg-surface-2 px-3 py-1.5 text-[13px] text-fg-soft hover:bg-surface-3 disabled:opacity-50">
                        Show more
                    </button>
                </div>
            )}
        </div>
    );
}

export function ScraperDashboard({ overview }: { overview: ScraperOverview }) {
    const clock = useClock(overview.period);
    const [mode, setMode] = useState<"trigger" | "page">("trigger");
    const t = overview.totals;
    const reads = t.calls + t.hits;
    const delta = t.previousCalls ? Math.round(((t.calls - t.previousCalls) / t.previousCalls) * 100) : null;
    const periodLabel = PERIODS.find((p) => p.value === overview.period)!.label.toLowerCase();

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-bold tracking-tight">Scraper traffic</h1>
                    <p className="mt-1 text-sm text-fg-dim">Every call to MyDramaList, who made it, and what the cache answered instead</p>
                </div>
                <div role="group" aria-label="Period" className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
                    {PERIODS.map((p) => (
                        <Link
                            key={p.value}
                            href={`/admin/scraper?period=${p.value}`}
                            aria-current={p.value === overview.period ? "page" : undefined}
                            className={`rounded-md px-2.5 py-1 text-[13px] transition-colors ${p.value === overview.period ? "bg-surface-4 text-fg" : "text-fg-muted hover:text-fg"}`}
                        >
                            {p.label}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <Kpi value={fmt(t.calls)} label={`calls to MDL, last ${periodLabel}`} sub={delta == null ? `${pct(t.ok, t.calls)} succeeded` : `${delta >= 0 ? "+" : ""}${delta}% on the period before · ${pct(t.ok, t.calls)} ok`} />
                <Kpi value={fmt(t.hits)} label="answered by the cache" bar={{ share: reads ? t.hits / reads : 0, color: "var(--color-watched)" }} sub={`${pct(t.hits, reads)} of all reads`} />
                <Kpi value={t.openings ? (t.callsInOpenings / t.openings).toFixed(1) : "—"} label="MDL calls per page opening" sub={`${fmt(t.openings)} openings reached MDL`} />
                <Kpi value={fmt(t.worstBurst.count)} label="worst 10 seconds" sub={t.worstBurst.at ? `${clock.tick(t.worstBurst.at)} · ${pageName(t.worstBurst.page)}` : "—"} />
                <Kpi
                    value={fmt(t.failed)}
                    label="failed"
                    bar={{ share: t.calls ? t.failed / t.calls : 0, color: t.failed ? "var(--color-dropped)" : "var(--color-watched)" }}
                    sub={Object.entries(t.failedByStatus).map(([s, n]) => `${n} × ${statusLabel(Number(s))}`).join(" · ") || `p50 ${t.p50} ms · p95 ${t.p95} ms`}
                />
            </div>

            <div className="space-y-3 rounded-lg bg-box p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-fg">Calls to MDL over time</h2>
                    <Rail value={mode} options={[{ value: "trigger", label: "By trigger" }, { value: "page", label: "By page" }]} onChange={setMode} label="Split the bars" />
                </div>
                {t.calls ? <Timeline overview={overview} mode={mode} /> : <p className="py-10 text-center text-[13px] text-fg-dim">No call recorded in this period yet.</p>}
            </div>

            <div className="rounded-lg bg-box p-4">
                <h2 className="mb-2 text-sm font-semibold text-fg">What each page costs</h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-[13px]">
                        <thead>
                            <tr className="text-left text-xs text-fg-dim">
                                <th className="pb-2 pr-3 font-normal">Page</th>
                                <th className="pb-2 pr-3 text-right font-normal">Openings</th>
                                <th className="pb-2 pr-3 text-right font-normal">MDL calls</th>
                                <th className="pb-2 pr-3 text-right font-normal">Per opening</th>
                                <th className="pb-2 pr-3 text-right font-normal">From cache</th>
                                <th className="pb-2 pr-3 text-right font-normal">Worst 10 s</th>
                                <th className="pb-2 text-right font-normal">Median time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overview.pages.map((p) => (
                                <tr key={p.page} className="border-t border-line-soft">
                                    <td className="py-2 pr-3">
                                        <div className="text-fg-soft">{pageName(p.page)}</div>
                                        <div className="font-mono text-[11px] text-fg-dim">{p.page}</div>
                                    </td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{p.openings || "—"}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-fg">{fmt(p.calls)}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{p.openings ? (p.calls / p.openings).toFixed(1) : "—"}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{pct(p.hits, p.hits + p.calls)}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums text-fg-muted">{p.worstBurst || "—"}</td>
                                    <td className="py-2 text-right tabular-nums text-fg-dim">{p.calls ? `${fmt(p.p50)} ms` : "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-box p-4">
                    <h2 className="mb-1 text-sm font-semibold text-fg">By trigger</h2>
                    <ul>
                        {overview.triggers.map((tr) => (
                            <li key={tr.trigger} className="border-b border-line-soft py-2.5 last:border-0">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="inline-flex items-center gap-2 text-[13.5px] text-fg-soft">
                                        <span className="size-2 rounded-sm" style={{ background: triggerOf(tr.trigger).color }} />
                                        {triggerOf(tr.trigger).label}
                                    </span>
                                    <span className="font-mono tabular-nums text-fg">{fmt(tr.calls)}</span>
                                </div>
                                <div className="mt-0.5 text-xs text-fg-dim">
                                    {triggerOf(tr.trigger).hint}
                                    {tr.hits ? ` · ${fmt(tr.hits)} from cache` : ""}
                                    {tr.last ? ` · last ${clock.tick(tr.last)}` : ""}
                                </div>
                                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-surface-3">
                                    <div className="h-full" style={{ width: `${t.calls ? (tr.calls / t.calls) * 100 : 0}%`, background: triggerOf(tr.trigger).color }} />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="rounded-lg bg-box p-4">
                    <h2 className="mb-1 text-sm font-semibold text-fg">Latest failures</h2>
                    {overview.failures.length ? (
                        <ul>
                            {overview.failures.map((f) => (
                                <li key={f.id} className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-0">
                                    <div className="min-w-0">
                                        <div className="text-[13px] text-fg-soft">
                                            <span className="font-mono tabular-nums text-fg-muted">{clock.at(f.at)}</span> {ROUTES[f.route] ?? f.route} · {about(f)}
                                        </div>
                                        <div className="truncate font-mono text-[11px] text-fg-dim">{f.pagePath ?? f.page ?? "—"} · {triggerOf(f.trigger).label}</div>
                                    </div>
                                    <span className="font-mono font-semibold tabular-nums text-fg">{statusLabel(f.status)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="py-4 text-[13px] text-fg-dim">No failure in this period.</p>
                    )}
                </div>
            </div>

            <Console overview={overview} />
        </div>
    );
}
