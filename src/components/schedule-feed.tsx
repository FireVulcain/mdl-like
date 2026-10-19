"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Eye } from "lucide-react";
import { toast } from "sonner";
import type { ScheduleEntry } from "@/actions/schedule";
import { updateProgress } from "@/actions/media";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";

/**
 * The schedule as a scroll of days instead of a month grid. Four layouts on
 * trial, sharing everything but the markup of a day: "cards" (closest to MDL's
 * airing calendar), "guide" (one line per episode, TV-guide style), "ready"
 * (aired-but-unseen first, then the programme as posters) and "rails" (one
 * horizontal poster rail per day).
 */
export type FeedVariant = "cards" | "guide" | "ready" | "rails";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLAN_TO_WATCH = "Plan to Watch";
const ASIAN_COUNTRIES = ["KR", "CN", "JP", "TW", "TH", "HK"];
// How long an episode counts as "airing now" after its start.
const LIVE_WINDOW_MS = 70 * 60_000;

function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr: string, n: number) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return toDateStr(new Date(y, m - 1, d + n));
}
function weekdayOf(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return (new Date(y, m - 1, d).getDay() + 6) % 7;
}
function longDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}, ${y}`;
}

/** One show's episodes on one day. */
type Airing = {
    key: string;
    date: string;
    first: ScheduleEntry;
    nums: number[];
    /** The earliest exact instant among the day's episodes, when known. */
    time: Date | null;
};

function episodeLabel(a: Airing) {
    const season = a.first.seasonNumber > 1 ? `S${a.first.seasonNumber} · ` : "";
    const n = a.nums;
    if (n.length === 1) return `${season}Episode ${n[0]}`;
    if (n.length === 2) return `${season}Episodes ${n[0]} & ${n[1]}`;
    return `${season}Episodes ${n[0]}–${n[n.length - 1]}`;
}

export function ScheduleFeed({
    entries,
    variant,
    initialShow,
    initialPrefs,
}: {
    entries: ScheduleEntry[];
    variant: FeedVariant;
    initialShow?: string;
    initialPrefs?: CalendarPreferences;
}) {
    // Times and "now" are only drawn after mount: the server renders in its own
    // time zone, and an hour printed there would be replaced on hydration.
    const [now, setNow] = useState<Date | null>(null);
    useEffect(() => {
        const first = setTimeout(() => setNow(new Date()), 0);
        const id = setInterval(() => setNow(new Date()), 60_000);
        return () => {
            clearTimeout(first);
            clearInterval(id);
        };
    }, []);

    const todayStr = toDateStr(now ?? new Date());
    const [includePlanToWatch, setIncludePlanToWatch] = useState(initialPrefs?.calendarIncludePlanToWatch ?? true);
    const asianOnly = initialPrefs?.calendarAsianOnly ?? false;
    const [showEmpty, setShowEmpty] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [span, setSpan] = useState(14);
    const [showFilter, setShowFilter] = useState<string | null>(initialShow ?? null);
    const [progressOverride, setProgressOverride] = useState<Record<string, number>>({});
    const [activeDay, setActiveDay] = useState<string | null>(null);

    const progressOf = (e: ScheduleEntry) => (e.userMediaId ? progressOverride[e.userMediaId] ?? e.progress ?? 0 : 0);

    const filtered = entries
        .filter((e) => !showFilter || e.mediaId === showFilter)
        .filter((e) => showFilter || !asianOnly || ASIAN_COUNTRIES.includes(e.originCountry))
        .filter((e) => showFilter || includePlanToWatch || e.status !== PLAN_TO_WATCH);

    const byDate = (() => {
        const map = new Map<string, Airing[]>();
        const groups = new Map<string, Airing>();
        for (const e of filtered) {
            const k = `${e.airDate}:${e.mediaId}:${e.seasonNumber}`;
            let a = groups.get(k);
            if (!a) {
                a = { key: k, date: e.airDate, first: e, nums: [], time: null };
                groups.set(k, a);
                if (!map.has(e.airDate)) map.set(e.airDate, []);
                map.get(e.airDate)!.push(a);
            }
            a.nums.push(e.episodeNumber);
            if (e.airDateTime) {
                const t = new Date(e.airDateTime);
                if (!isNaN(t.getTime()) && (!a.time || t < a.time)) a.time = t;
            }
        }
        for (const a of groups.values()) a.nums.sort((x, y) => x - y);
        return map;
    })();

    const isPlanned = (a: Airing) => a.first.status === PLAN_TO_WATCH;
    const timeKey = (a: Airing) => (a.time ? a.time.getTime() : Number.MAX_SAFE_INTEGER);
    // Shows being watched first, then by time; the guide reads by time first.
    const byWatching = (a: Airing, b: Airing) => Number(isPlanned(a)) - Number(isPlanned(b)) || timeKey(a) - timeKey(b) || a.first.title.localeCompare(b.first.title);
    const byTime = (a: Airing, b: Airing) => timeKey(a) - timeKey(b) || Number(isPlanned(a)) - Number(isPlanned(b)) || a.first.title.localeCompare(b.first.title);
    const airingsOn = (d: string, sort = byWatching) => [...(byDate.get(d) ?? [])].sort(sort);
    const episodesOn = (d: string) => (byDate.get(d) ?? []).reduce((n, a) => n + a.nums.length, 0);

    const days: string[] = [];
    for (let i = showPast ? -7 : 0; i < span; i++) days.push(addDays(todayStr, i));

    const todayTimed = airingsOn(todayStr, byTime).filter((a) => a.time);
    const nextUp = now ? todayTimed.find((a) => a.time!.getTime() > now.getTime()) : undefined;
    const liveState = (a: Airing): "now" | "next" | null => {
        if (!now || !a.time || a.date !== todayStr) return null;
        const t = a.time.getTime();
        if (now.getTime() >= t && now.getTime() < t + LIVE_WINDOW_MS) return "now";
        return nextUp === a ? "next" : null;
    };
    const formatTime = (t: Date | null) => (t && now ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
    const relative = (d: string) => (d === todayStr ? "Today" : d === addDays(todayStr, 1) ? "Tomorrow" : d === addDays(todayStr, -1) ? "Yesterday" : null);

    // Where an airing sits against your progress, for shows you are watching.
    const mine = (a: Airing): "seen" | "up" | null => {
        if (a.first.status !== "Watching" || !a.first.userMediaId) return null;
        const p = progressOf(a.first);
        if (a.nums[a.nums.length - 1] <= p) return "seen";
        if (a.nums[0] <= p + 1 && a.date <= todayStr) return "up";
        return null;
    };

    const setProgress = async (e: ScheduleEntry, to: number) => {
        if (!e.userMediaId) return;
        const id = e.userMediaId;
        const before = progressOf(e);
        setProgressOverride((prev) => ({ ...prev, [id]: to }));
        try {
            await updateProgress(id, to);
            toast.success(`${e.title}: episode ${to} marked as seen`);
        } catch {
            setProgressOverride((prev) => ({ ...prev, [id]: before }));
            toast.error("Could not save your progress");
        }
    };
    // A whole season dropped at once advances one episode at a time; a double
    // bill is marked as one.
    const markTarget = (a: Airing) => (a.nums.length > 2 ? progressOf(a.first) + 1 : a.nums[a.nums.length - 1]);

    const markButton = (a: Airing) => {
        const m = mine(a);
        if (m === "seen")
            return (
                <span className="inline-flex items-center gap-1.5 text-xs text-fg-dim">
                    <Check className="h-3.5 w-3.5" />
                    Seen
                </span>
            );
        if (m !== "up") return null;
        const to = markTarget(a);
        return (
            <button
                onClick={() => setProgress(a.first, to)}
                className="cursor-pointer inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md border border-line-strong px-2.5 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
            >
                <Eye className="h-3.5 w-3.5" />
                {a.nums.length > 2 ? `Mark ep ${to} seen` : "Mark seen"}
            </button>
        );
    };

    const progressText = (e: ScheduleEntry) =>
        e.status === "Watching" && e.userMediaId ? `Seen ${progressOf(e)}${e.totalEp ? ` of ${e.totalEp}` : ""}` : null;

    const pills = (a: Airing) => (
        <>
            {a.nums[0] === 1 && <span className="rounded bg-primary/10 px-1.5 text-[11px] font-semibold leading-4 text-primary">Premiere</span>}
            {isPlanned(a) && <span className="rounded px-1.5 text-[11px] font-semibold leading-4 text-fg-dim ring-1 ring-inset ring-line-strong">Plan to Watch</span>}
        </>
    );

    const poster = (e: ScheduleEntry, sizes: string, className: string) => (
        <div className={`relative shrink-0 overflow-hidden bg-surface-3 ${className}`}>
            {e.poster ? (
                <Image unoptimized={true} src={e.poster} alt="" fill sizes={sizes} className="object-cover" />
            ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-fg-muted">{e.title.slice(0, 2).toUpperCase()}</div>
            )}
        </div>
    );
    const mediaHref = (e: ScheduleEntry) => `/media/${e.mediaId}?season=${e.seasonNumber}`;

    // ---- shared pieces ----
    const jumpTo = (d: string) => {
        const el = document.getElementById(`day-${d}`) ?? [...document.querySelectorAll<HTMLElement>("[id^='day-']")].find((n) => n.id.slice(4) >= d);
        el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };

    // The strip follows the scroll: the day nearest the top is the active chip.
    useEffect(() => {
        if (variant !== "cards" && variant !== "rails") return;
        const nodes = document.querySelectorAll<HTMLElement>("[id^='day-']");
        const observer = new IntersectionObserver(
            (items) => {
                const visible = items.filter((x) => x.isIntersecting).map((x) => (x.target as HTMLElement).id.slice(4)).sort();
                if (visible.length) setActiveDay(visible[0]);
            },
            { rootMargin: "-110px 0px -60% 0px" },
        );
        nodes.forEach((n) => observer.observe(n));
        return () => observer.disconnect();
    }, [variant, span, showPast, showEmpty, includePlanToWatch, showFilter]);

    const strip = (
        <nav aria-label="Jump to a day" className="sticky top-0 z-20 -mx-2 flex gap-1.5 overflow-x-auto border-b border-line bg-page/90 px-2 py-2 backdrop-blur-md [scrollbar-width:none]">
            {days
                .filter((d) => d >= todayStr)
                .map((d) => {
                    const c = episodesOn(d);
                    const active = (activeDay ?? todayStr) === d;
                    return (
                        <button
                            key={d}
                            onClick={() => jumpTo(d)}
                            className={`cursor-pointer flex w-14.5 shrink-0 flex-col items-center gap-0.5 rounded-lg pt-1.5 pb-2 transition-colors hover:bg-surface-2 ${active ? "bg-surface-3" : ""} ${c ? "" : "opacity-45"}`}
                        >
                            <span className="text-[11px] uppercase tracking-wider text-fg-muted">{d === todayStr ? "Today" : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                            <span className={`text-[17px] font-bold tabular-nums ${d === todayStr ? "text-primary" : active ? "text-fg" : "text-fg-soft"}`}>{Number(d.slice(8))}</span>
                            <span className="text-[11px] tabular-nums text-fg-dim">{c ? `${c} ep${c > 1 ? "s" : ""}` : "—"}</span>
                        </button>
                    );
                })}
        </nav>
    );

    const dayHeading = (d: string, sticky = false) => {
        const c = episodesOn(d);
        const rel = relative(d);
        return (
            <div className={`flex items-baseline justify-between gap-3 ${sticky ? "sticky top-0 z-10 -mx-2 bg-page/90 px-2 py-2.5 backdrop-blur-md" : "mb-3.5"}`}>
                <div>
                    <p className="text-[13px] text-fg-muted">{longDate(d)}</p>
                    <h2 className={`mt-0.5 flex items-baseline gap-2.5 font-bold tracking-tight text-fg ${sticky ? "text-xl" : "text-[26px]"}`}>
                        {WEEKDAY_LONG[weekdayOf(d)]}
                        {rel && <span className="text-[13px] font-semibold tracking-normal text-primary">{rel}</span>}
                    </h2>
                </div>
                <span className="text-[13px] tabular-nums text-fg-dim">
                    {c} episode{c !== 1 ? "s" : ""}
                </span>
            </div>
        );
    };

    const quietDay = (d: string) => (
        <div key={d} id={`day-${d}`} className="flex scroll-mt-28 items-baseline gap-2.5 pt-3.5 text-[13px] text-fg-dim">
            <b className="font-semibold text-fg-muted">
                {WEEKDAY_LONG[weekdayOf(d)]} {Number(d.slice(8))}
            </b>
            Nothing airing
        </div>
    );

    const posterCard = (a: Airing, width?: string) => {
        const live = liveState(a);
        const m = mine(a);
        const t = formatTime(a.time);
        return (
            <Link key={a.key} href={mediaHref(a.first)} className={`group flex min-w-0 flex-col gap-1.5 ${width ?? ""}`}>
                <span className={`relative block aspect-2/3 max-w-full overflow-hidden rounded-lg bg-surface-3 ${m === "seen" ? "opacity-50" : ""}`}>
                    {a.first.poster && (
                        <Image unoptimized={true} src={a.first.poster} alt="" fill sizes="140px" className="object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    )}
                    <span className="absolute top-1.5 left-1.5 flex gap-1">
                        {live === "now" && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">NOW</span>}
                        {a.nums[0] === 1 && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">PREMIERE</span>}
                        {isPlanned(a) && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-gray-300">PLAN</span>}
                    </span>
                    <span className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                        <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-100">
                            {a.nums.length === 1 ? `Ep ${a.nums[0]}` : `Ep ${a.nums[0]}–${a.nums[a.nums.length - 1]}`}
                        </span>
                        {t && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-100">{t}</span>}
                    </span>
                </span>
                <span className={`line-clamp-2 text-[13px] leading-snug ${isPlanned(a) ? "font-medium text-fg-soft" : "font-semibold text-fg"}`}>{a.first.title}</span>
                <span className="text-xs text-fg-muted">{m === "seen" ? "Seen" : progressText(a.first) ?? (isPlanned(a) ? "Plan to Watch" : "")}</span>
            </Link>
        );
    };

    // ---- the four layouts ----
    const cardsDay = (d: string) => (
        <section key={d} id={`day-${d}`} className={`scroll-mt-28 pt-7 ${d < todayStr ? "opacity-60" : ""}`}>
            {dayHeading(d)}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 lg:grid-cols-2">
                {airingsOn(d).map((a) => {
                    const live = liveState(a);
                    const m = mine(a);
                    const t = formatTime(a.time);
                    const prog = progressText(a.first);
                    return (
                        <article
                            key={a.key}
                            className={`relative flex min-h-23 items-center gap-3.5 rounded-lg border border-line bg-surface-1 py-2.5 pr-3.5 pl-2.5 transition-colors hover:bg-surface-2 ${m === "seen" ? "opacity-55" : ""}`}
                        >
                            {live && (
                                <span
                                    className={`absolute -top-2.5 left-18 inline-flex h-4.5 items-center gap-1.5 rounded px-1.5 text-[10px] font-bold tracking-wide ${live === "now" ? "bg-primary text-white" : "bg-page text-primary ring-1 ring-inset ring-primary"}`}
                                >
                                    {live === "now" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                    {live === "now" ? "AIRING NOW" : "AIRING NEXT"}
                                </span>
                            )}
                            <Link href={mediaHref(a.first)}>{poster(a.first, "52px", "h-19.5 w-13 rounded-md")}</Link>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <Link href={mediaHref(a.first)} className={`truncate text-[15px] hover:underline hover:underline-offset-3 ${isPlanned(a) ? "font-medium text-fg-soft" : "font-semibold text-fg"}`}>
                                    {a.first.title}
                                </Link>
                                <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
                                    {episodeLabel(a)}
                                    {pills(a)}
                                </span>
                                {prog && <span className="text-xs tabular-nums text-fg-dim">{prog}</span>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1.5 max-sm:hidden">
                                {t ? <span className="text-[15px] font-semibold tabular-nums text-fg-soft">{t}</span> : <span className="text-xs text-fg-dim">Time unknown</span>}
                                {markButton(a)}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );

    const guideDay = (d: string) => {
        const list = airingsOn(d, byTime);
        // The NOW line only means something among timed episodes: a day of
        // "any time" rows has nowhere true to put it.
        const nowAt = d === todayStr && now && list.some((a) => a.time) ? list.findIndex((a) => a.time && a.time.getTime() > now.getTime()) : -2;
        const nowLine = (
            <div key="now" className="flex items-center gap-2.5 px-1 py-0.5 text-[11px] font-bold tracking-wider text-primary after:h-px after:flex-1 after:bg-primary/60">
                NOW · {formatTime(now)}
            </div>
        );
        return (
            <section key={d} id={`day-${d}`} className={`scroll-mt-4 pt-6 ${d < todayStr ? "opacity-60" : ""}`}>
                {dayHeading(d, true)}
                <div className="flex flex-col border-t border-line">
                    {list.map((a, i) => {
                        const live = liveState(a);
                        const m = mine(a);
                        const t = formatTime(a.time);
                        const prog = progressText(a.first);
                        return (
                            <div key={a.key} className="contents">
                                {i === nowAt && nowLine}
                                <div className={`grid grid-cols-[64px_36px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-line-soft px-1 py-2.5 hover:bg-surface-1 max-sm:grid-cols-[52px_32px_minmax(0,1fr)] ${m === "seen" ? "opacity-50" : ""}`}>
                                    <span className={`tabular-nums ${t ? `text-sm font-semibold ${live === "now" ? "text-primary" : "text-fg-soft"}` : "text-xs text-fg-dim"}`}>{t ?? "Any time"}</span>
                                    <Link href={mediaHref(a.first)}>{poster(a.first, "36px", "h-13.5 w-9 rounded")}</Link>
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <Link href={mediaHref(a.first)} className={`truncate text-sm hover:underline ${isPlanned(a) ? "font-medium text-fg-soft" : "font-semibold text-fg"}`}>
                                            {a.first.title}
                                        </Link>
                                        <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
                                            {episodeLabel(a)}
                                            {pills(a)}
                                            {live === "now" && <span className="rounded bg-primary/10 px-1.5 text-[11px] font-semibold leading-4 text-primary">Airing now</span>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 max-sm:col-start-3">
                                        {prog && <span className="text-xs tabular-nums text-fg-dim">{prog}</span>}
                                        {markButton(a)}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {nowAt === -1 && nowLine}
                </div>
            </section>
        );
    };

    const gridDay = (d: string) => (
        <section key={d} id={`day-${d}`} className={`scroll-mt-4 pt-7 ${d < todayStr ? "opacity-60" : ""}`}>
            {dayHeading(d)}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3.5 gap-y-4.5">{airingsOn(d).map((a) => posterCard(a))}</div>
        </section>
    );

    const railDay = (d: string) => {
        const c = episodesOn(d);
        const rel = relative(d);
        return (
            <section key={d} id={`day-${d}`} className={`grid scroll-mt-28 grid-cols-[116px_minmax(0,1fr)] gap-5 border-t border-line py-4.5 max-sm:grid-cols-1 max-sm:gap-2.5 ${d < todayStr ? "opacity-60" : ""}`}>
                <div className="flex flex-col gap-0.5 max-sm:flex-row max-sm:items-baseline max-sm:gap-2">
                    <span className="text-[13px] text-fg-muted">{WEEKDAY_LONG[weekdayOf(d)]}</span>
                    <b className={`text-3xl leading-none font-bold tabular-nums ${d === todayStr ? "text-primary" : "text-fg"}`}>{Number(d.slice(8))}</b>
                    {rel && <span className="text-xs font-semibold text-primary">{rel}</span>}
                    <span className="mt-1 text-xs text-fg-dim">{c ? `${c} episode${c !== 1 ? "s" : ""}` : "Nothing airing"}</span>
                </div>
                <div className="flex gap-3.5 overflow-x-auto pb-1.5">{airingsOn(d).map((a) => posterCard(a, "w-32 shrink-0"))}</div>
            </section>
        );
    };

    // "Ready to watch": aired episodes past your progress, per show you watch.
    const ready = (() => {
        const shows = new Map<string, { e: ScheduleEntry; unseen: number[] }>();
        for (const e of filtered) {
            if (e.status !== "Watching" || !e.userMediaId || e.airDate > todayStr) continue;
            if (e.episodeNumber <= progressOf(e)) continue;
            const k = e.userMediaId;
            if (!shows.has(k)) shows.set(k, { e, unseen: [] });
            shows.get(k)!.unseen.push(e.episodeNumber);
        }
        return [...shows.values()].map((r) => ({ ...r, unseen: [...new Set(r.unseen)].sort((a, b) => a - b) })).sort((a, b) => b.unseen.length - a.unseen.length);
    })();
    const readyPanel = (
        <section className="flex flex-col gap-3.5 rounded-xl bg-box p-4.5">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-fg">Ready to watch</h2>
                <span className="text-[13px] text-fg-muted">
                    {ready.length ? `${ready.reduce((n, r) => n + r.unseen.length, 0)} aired episodes you haven't seen` : "You're up to date"}
                </span>
            </div>
            {ready.length > 0 && (
                <div className="flex gap-3.5 overflow-x-auto pb-1">
                    {ready.map(({ e, unseen }) => {
                        const p = progressOf(e);
                        const a = unseen[0];
                        const b = unseen[unseen.length - 1];
                        return (
                            <div key={e.userMediaId} className="flex w-60 shrink-0 items-center gap-3">
                                <Link href={mediaHref(e)}>{poster(e, "56px", "h-21 w-14 rounded-md")}</Link>
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <Link href={mediaHref(e)} className="truncate text-sm font-semibold text-fg hover:underline">
                                        {e.title}
                                    </Link>
                                    <span className="text-xs text-fg-muted">{a === b ? `Episode ${a}` : `Episodes ${a}–${b}`} available</span>
                                    <span className="text-xs tabular-nums text-fg-dim">
                                        Seen {p}
                                        {e.totalEp ? ` of ${e.totalEp}` : ""}
                                    </span>
                                    {e.totalEp ? (
                                        <span className="mt-0.5 h-0.75 overflow-hidden rounded-full bg-surface-4">
                                            <span className="block h-full rounded-full bg-fg-muted" style={{ width: `${Math.min(100, Math.round((p / e.totalEp) * 100))}%` }} />
                                        </span>
                                    ) : null}
                                    <button
                                        onClick={() => setProgress(e, p + 1)}
                                        className="cursor-pointer mt-1 inline-flex h-7 items-center gap-1.5 self-start rounded-md border border-line-strong px-2.5 text-xs font-medium text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                                    >
                                        <Eye className="h-3.5 w-3.5" />
                                        Mark ep {p + 1} seen
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );

    const renderDay = { cards: cardsDay, guide: guideDay, ready: gridDay, rails: railDay }[variant];
    const visibleDays = days.filter((d) => episodesOn(d) > 0 || showEmpty);
    const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i));
    const weekShows = new Set(nextWeek.flatMap((d) => (byDate.get(d) ?? []).map((a) => a.first.mediaId))).size;
    const weekEpisodes = nextWeek.reduce((n, d) => n + episodesOn(d), 0);
    const filteredShow = showFilter ? entries.find((e) => e.mediaId === showFilter) : undefined;

    return (
        <div className="container mx-auto max-w-6xl space-y-5 px-4 pt-4 pb-16">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="font-display text-3xl font-bold text-fg">Schedule</h1>
                    <p className="text-sm text-fg-muted">
                        Next 7 days · {weekShows} show{weekShows !== 1 ? "s" : ""} · {weekEpisodes} episode{weekEpisodes !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
                        <input
                            type="checkbox"
                            checked={includePlanToWatch}
                            onChange={(ev) => {
                                setIncludePlanToWatch(ev.target.checked);
                                saveCalendarPreferences({ calendarIncludePlanToWatch: ev.target.checked });
                            }}
                            className="h-3.75 w-3.75 accent-primary"
                        />
                        Plan to Watch
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
                        <input type="checkbox" checked={showEmpty} onChange={(ev) => setShowEmpty(ev.target.checked)} className="h-3.75 w-3.75 accent-primary" />
                        Empty days
                    </label>
                    <button
                        onClick={() => jumpTo(todayStr)}
                        className="cursor-pointer h-9 rounded-lg border border-line-strong px-3 text-sm text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                        Today
                    </button>
                </div>
            </div>

            {showFilter && (
                <div className="flex items-center gap-3.5 rounded-lg bg-box px-4 py-3">
                    <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg">{filteredShow?.title ?? "This show"}</p>
                    <button onClick={() => setShowFilter(null)} className="cursor-pointer shrink-0 text-[13px] text-fg-dim transition-colors hover:text-fg">
                        Show all
                    </button>
                </div>
            )}

            {variant === "ready" && readyPanel}
            {(variant === "cards" || variant === "rails") && strip}

            <div className="flex flex-col">
                {!showPast && (
                    <button
                        onClick={() => setShowPast(true)}
                        className="cursor-pointer mt-2 self-start rounded-lg border border-line-strong px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                        Show the last 7 days
                    </button>
                )}
                {visibleDays.length === 0 && <p className="py-16 text-center text-sm text-fg-dim">Nothing airing in the next {span} days</p>}
                {visibleDays.map((d) => (episodesOn(d) > 0 ? renderDay(d) : quietDay(d)))}
                <button
                    onClick={() => setSpan((s) => s + 14)}
                    className="cursor-pointer mt-7 self-center rounded-lg border border-line-strong px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
                >
                    Show 2 more weeks
                </button>
            </div>
        </div>
    );
}
