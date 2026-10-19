"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, CalendarDays, Check, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { ScheduleEntry } from "@/actions/schedule";
import { getScheduleRefreshTargets, refreshScheduleChunk } from "@/actions/schedule";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";
import { DragScroll } from "@/components/drag-scroll";

export type { ScheduleEntry };

/**
 * The schedule as a scroll of days, starting today: each day a grid of
 * posters, with a strip of day chips pinned above it to jump around. It
 * replaced a month grid whose 30 columns grew harder to read with every show
 * on the list; a day here simply grows taller.
 */

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PLAN_TO_WATCH = "Plan to Watch";
const ASIAN_COUNTRIES = ["KR", "CN", "JP", "TW", "TH", "HK"];
// How long an episode counts as "airing now" after its start.
const LIVE_WINDOW_MS = 70 * 60_000;
const REFRESH_CHUNK = 4;

function toDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(dateStr: string, n: number) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return toDateStr(new Date(y, m - 1, d + n));
}
function daysBetween(a: string, b: string) {
    const [ay, am, ad] = a.split("-").map(Number);
    const [by, bm, bd] = b.split("-").map(Number);
    return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
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
    /** The earliest exact instant among the day's episodes, when the source knows it. */
    time: Date | null;
};

export function ScheduleFeed({
    entries,
    initialDate,
    initialShow,
    initialPrefs,
}: {
    entries: ScheduleEntry[];
    /** A YYYY-MM-DD from `?date=` — the next-episode countdown links here. */
    initialDate?: string;
    /** A `mediaId` from `?show=` — the media page links here already narrowed. */
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

    // A linked date outside the default range widens it, so it can be scrolled to.
    const linked = initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : null;
    const linkedOffset = linked ? daysBetween(toDateStr(new Date()), linked) : 0;

    const [asianOnly, setAsianOnly] = useState(initialPrefs?.calendarAsianOnly ?? false);
    const [includePlanToWatch, setIncludePlanToWatch] = useState(initialPrefs?.calendarIncludePlanToWatch ?? true);
    const [showEmpty, setShowEmpty] = useState(false);
    // The last week is always there, above today: the page opens scrolled to
    // today, and scrolling up is how you look back.
    const pastDays = linkedOffset < -7 ? Math.min(-linkedOffset, 60) : 7;
    const [span, setSpan] = useState(Math.max(14, linkedOffset + 1));
    const [showFilter, setShowFilter] = useState<string | null>(initialShow ?? null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [activeDay, setActiveDay] = useState<string | null>(null);

    const filtered = entries
        .filter((e) => !showFilter || e.mediaId === showFilter)
        .filter((e) => showFilter || !asianOnly || ASIAN_COUNTRIES.includes(e.originCountry))
        .filter((e) => showFilter || includePlanToWatch || e.status !== PLAN_TO_WATCH);

    const byDate = new Map<string, Airing[]>();
    {
        const groups = new Map<string, Airing>();
        for (const e of filtered) {
            const k = `${e.airDate}:${e.mediaId}:${e.seasonNumber}`;
            let a = groups.get(k);
            if (!a) {
                a = { key: k, date: e.airDate, first: e, nums: [], time: null };
                groups.set(k, a);
                if (!byDate.has(e.airDate)) byDate.set(e.airDate, []);
                byDate.get(e.airDate)!.push(a);
            }
            a.nums.push(e.episodeNumber);
            if (e.airDateTime) {
                const t = new Date(e.airDateTime);
                if (!isNaN(t.getTime()) && (!a.time || t < a.time)) a.time = t;
            }
        }
        for (const a of groups.values()) a.nums.sort((x, y) => x - y);
    }

    const isPlanned = (a: Airing) => a.first.status === PLAN_TO_WATCH;
    const timeKey = (a: Airing) => (a.time ? a.time.getTime() : Number.MAX_SAFE_INTEGER);
    // Shows being watched come first, then by air time.
    const airingsOn = (d: string) =>
        [...(byDate.get(d) ?? [])].sort(
            (a, b) => Number(isPlanned(a)) - Number(isPlanned(b)) || timeKey(a) - timeKey(b) || a.first.title.localeCompare(b.first.title),
        );
    const episodesOn = (d: string) => (byDate.get(d) ?? []).reduce((n, a) => n + a.nums.length, 0);

    const days: string[] = [];
    for (let i = -pastDays; i < span; i++) days.push(addDays(todayStr, i));
    const visibleDays = days.filter((d) => episodesOn(d) > 0 || showEmpty || d === linked);

    const isLive = (a: Airing) => !!(now && a.time && now.getTime() >= a.time.getTime() && now.getTime() < a.time.getTime() + LIVE_WINDOW_MS);
    const formatTime = (t: Date | null) => (t && now ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
    const relative = (d: string) => (d === todayStr ? "Today" : d === addDays(todayStr, 1) ? "Tomorrow" : d === addDays(todayStr, -1) ? "Yesterday" : null);
    const mediaHref = (e: ScheduleEntry) => `/media/${e.mediaId}?season=${e.seasonNumber}`;

    // The day itself, or the first day after it with anything on — a quiet
    // day has no section unless empty days are shown.
    const dayNode = (d: string) =>
        document.getElementById(`day-${d}`) ?? [...document.querySelectorAll<HTMLElement>("[id^='day-']")].find((n) => n.id.slice(4) >= d);
    // The days scroll inside their own box, sized to the rest of the window,
    // so the page itself stays put with its header and filters in view.
    const scroller = useRef<HTMLDivElement>(null);
    const [scrollerHeight, setScrollerHeight] = useState<number | null>(null);
    useEffect(() => {
        const measure = () => {
            const el = scroller.current;
            if (!el) return;
            const top = el.getBoundingClientRect().top + window.scrollY;
            setScrollerHeight(Math.max(420, window.innerHeight - top - 24));
        };
        const frame = requestAnimationFrame(measure);
        window.addEventListener("resize", measure);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", measure);
        };
    }, [showFilter]);

    const scrollToDay = (d: string, smooth: boolean) => {
        const box = scroller.current;
        const node = dayNode(d);
        if (!box || !node) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        box.scrollTo({ top: node.offsetTop - 4, behavior: smooth && !reduce ? "smooth" : "auto" });
    };
    const jumpTo = (d: string) => scrollToDay(d, true);

    // Open the box on today — or on the linked day, arriving from a countdown
    // — with the past week above it, reached by scrolling up inside the box.
    useEffect(() => {
        const frame = requestAnimationFrame(() => scrollToDay(linked ?? toDateStr(new Date()), false));
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
    }, []);

    // The strip scrolls sideways to keep the active chip in view, so a day
    // weeks ahead in the box is still the one lit up above it.
    const strip = useRef<HTMLElement>(null);
    useEffect(() => {
        const bar = strip.current;
        if (!bar || !activeDay) return;
        const chip = bar.querySelector<HTMLElement>(`[data-day="${activeDay}"]`);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        // A day in the past week has no chip: the strip goes back to its start.
        const left = chip ? chip.offsetLeft - bar.clientWidth / 2 + chip.offsetWidth / 2 : 0;
        bar.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    }, [activeDay]);

    // The strip follows the box's scroll: the day nearest its top is the active chip.
    useEffect(() => {
        const box = scroller.current;
        if (!box) return;
        const nodes = box.querySelectorAll<HTMLElement>("[id^='day-']");
        // The last days can never reach the top of the box: at the bottom,
        // the last one is the active day.
        const atBottom = () => box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
        const observer = new IntersectionObserver(
            (items) => {
                if (atBottom()) return;
                const visible = items.filter((x) => x.isIntersecting).map((x) => (x.target as HTMLElement).id.slice(4)).sort();
                if (visible.length) setActiveDay(visible[0]);
            },
            { root: box, rootMargin: "0px 0px -70% 0px" },
        );
        nodes.forEach((n) => observer.observe(n));
        const onScroll = () => {
            if (atBottom() && nodes.length) setActiveDay(nodes[nodes.length - 1].id.slice(4));
        };
        box.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            observer.disconnect();
            box.removeEventListener("scroll", onScroll);
        };
    }, [span, pastDays, showEmpty, includePlanToWatch, asianOnly, showFilter]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setMenuOpen(false);
        const toastId = toast.loading("Refreshing the schedule…");
        let refreshed = 0;
        try {
            const targets = await getScheduleRefreshTargets();
            if (targets.length === 0) {
                toast.success("Nothing to refresh", { id: toastId, description: "No airing shows on your list." });
                return;
            }
            const ids = targets.map((t) => t.mediaId);
            toast.loading(`Refreshing the schedule… 0/${ids.length}`, { id: toastId });
            for (let i = 0; i < ids.length; i += REFRESH_CHUNK) {
                const result = await refreshScheduleChunk(ids.slice(i, i + REFRESH_CHUNK));
                refreshed += result.count;
                toast.loading(`Refreshing the schedule… ${Math.min(i + REFRESH_CHUNK, ids.length)}/${ids.length}`, { id: toastId });
            }
            toast.success(`Schedule refreshed for ${refreshed} show${refreshed !== 1 ? "s" : ""}`, { id: toastId });
            window.location.reload();
        } catch (error) {
            console.error("Schedule refresh failed:", error);
            toast.error("Failed to refresh the schedule", {
                id: toastId,
                description: refreshed > 0 ? `${refreshed} show${refreshed !== 1 ? "s" : ""} were updated before the error` : undefined,
            });
            if (refreshed > 0) window.location.reload();
        } finally {
            setIsRefreshing(false);
        }
    };

    const clearShowFilter = () => {
        setShowFilter(null);
        const url = new URL(window.location.href);
        url.searchParams.delete("show");
        window.history.replaceState({}, "", url);
    };
    const filteredShow = showFilter ? entries.find((e) => e.mediaId === showFilter) : undefined;
    const filterSummary = (() => {
        if (!showFilter) return null;
        const ahead = filtered.filter((e) => e.airDate >= todayStr).sort((a, b) => (a.airDate < b.airDate ? -1 : 1));
        if (ahead.length === 0) return "No upcoming episodes";
        const names = [...new Set(ahead.map((e) => weekdayOf(e.airDate)))].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]);
        const when = names.length === 1 ? names[0] : names.length <= 3 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : "Several days a week";
        const first = ahead[0].episodeNumber;
        const last = ahead[ahead.length - 1].episodeNumber;
        return `${when} · ${first === last ? `episode ${first}` : `episodes ${first} to ${last}`} ahead`;
    })();

    const nextWeek = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i));
    const weekShows = new Set(nextWeek.flatMap((d) => (byDate.get(d) ?? []).map((a) => a.first.mediaId))).size;
    const weekEpisodes = nextWeek.reduce((n, d) => n + episodesOn(d), 0);
    const filtersOn = asianOnly || !includePlanToWatch || showEmpty;

    const posterCard = (a: Airing) => {
        const t = formatTime(a.time);
        const planned = isPlanned(a);
        const e = a.first;
        return (
            <Link key={a.key} href={mediaHref(e)} className="group flex min-w-0 flex-col gap-1.5">
                <span className="relative block aspect-2/3 max-w-full overflow-hidden rounded-lg bg-surface-3">
                    {e.poster ? (
                        <Image unoptimized={true} src={e.poster} alt="" fill sizes="160px" className="object-cover transition-transform duration-200 group-hover:scale-[1.03]" />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-fg-muted">{e.title.slice(0, 2).toUpperCase()}</span>
                    )}
                    {(isLive(a) || a.nums[0] === 1) && (
                        <span className="absolute top-1.5 left-1.5 flex gap-1">
                            {isLive(a) && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white">AIRING NOW</span>}
                            {a.nums[0] === 1 && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">PREMIERE</span>}
                        </span>
                    )}
                    <span className="absolute inset-x-1.5 bottom-1.5 flex justify-between gap-1">
                        <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-100">
                            {e.seasonNumber > 1 ? `S${e.seasonNumber} ` : ""}
                            {a.nums.length === 1 ? `Ep ${a.nums[0]}` : `Ep ${a.nums[0]}–${a.nums[a.nums.length - 1]}`}
                        </span>
                        {t && <span className="rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-100">{t}</span>}
                    </span>
                </span>
                <span className={`line-clamp-2 text-[13px] leading-snug ${planned ? "font-medium text-fg-soft" : "font-semibold text-fg"}`}>{e.title}</span>
                {/* Which list the show is on, said in words under the title
                    rather than as a code on the poster: progress for a show
                    being watched, the list's own name for one that is not. */}
                {planned ? (
                    <span className="flex items-center gap-1 text-xs text-fg-dim">
                        <Bookmark className="h-3 w-3" />
                        Plan to Watch
                    </span>
                ) : e.userMediaId && e.status === "Watching" ? (
                    <span className="text-xs tabular-nums text-fg-muted">
                        Seen {e.progress ?? 0}
                        {e.totalEp ? ` of ${e.totalEp}` : ""}
                    </span>
                ) : null}
            </Link>
        );
    };

    return (
        <div className="min-h-screen">
            <div className="container mx-auto max-w-6xl space-y-5 px-4 py-8">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="font-display text-3xl font-bold text-fg">Schedule</h1>
                        <p className="text-sm text-fg-muted">
                            {weekEpisodes > 0
                                ? `Next 7 days · ${weekShows} show${weekShows !== 1 ? "s" : ""} · ${weekEpisodes} episode${weekEpisodes !== 1 ? "s" : ""}`
                                : "Nothing airing in the next 7 days"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button
                                onClick={() => setMenuOpen(!menuOpen)}
                                aria-label="Filters"
                                aria-expanded={menuOpen}
                                className={`cursor-pointer flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${menuOpen || filtersOn ? "bg-primary/20 text-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg"}`}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                            </button>
                            {menuOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                                    <div className="absolute top-full right-0 z-40 mt-2 min-w-52 rounded-lg border border-line-strong bg-panel/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                                        <p className="px-3 py-1.5 text-xs font-semibold tracking-wider text-fg-dim uppercase">Region</p>
                                        {[false, true].map((v) => (
                                            <button
                                                key={String(v)}
                                                onClick={() => {
                                                    setAsianOnly(v);
                                                    saveCalendarPreferences({ calendarAsianOnly: v });
                                                }}
                                                className="cursor-pointer flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                                            >
                                                {v ? "Asian shows only" : "All shows"}
                                                {asianOnly === v && <Check className="h-3.5 w-3.5 text-primary" />}
                                            </button>
                                        ))}
                                        <div className="my-1.5 border-t border-line-strong" />
                                        <p className="px-3 py-1.5 text-xs font-semibold tracking-wider text-fg-dim uppercase">Show</p>
                                        <button
                                            onClick={() => {
                                                const next = !includePlanToWatch;
                                                setIncludePlanToWatch(next);
                                                saveCalendarPreferences({ calendarIncludePlanToWatch: next });
                                            }}
                                            className="cursor-pointer flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                                        >
                                            Plan to Watch
                                            {includePlanToWatch && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                        <button
                                            onClick={() => setShowEmpty(!showEmpty)}
                                            className="cursor-pointer flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg"
                                        >
                                            Days with nothing airing
                                            {showEmpty && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                        <div className="my-1.5 border-t border-line-strong" />
                                        <button
                                            onClick={handleRefresh}
                                            disabled={isRefreshing}
                                            className="cursor-pointer flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 text-blue-400 ${isRefreshing ? "animate-spin" : ""}`} />
                                            {isRefreshing ? "Refreshing..." : "Refresh schedule"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => jumpTo(todayStr)}
                            className="cursor-pointer h-9 rounded-lg border border-line-strong px-3 text-sm text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
                        >
                            Today
                        </button>
                    </div>
                </div>

                {/* The active show filter: arriving from a show's page means the
                    feed is deliberately near-empty, and that needs saying before
                    the emptiness reads as a bug. */}
                {showFilter && (
                    <div className="flex items-center gap-3.5 rounded-lg bg-box px-4 py-3">
                        {filteredShow?.poster && (
                            <div className="relative h-10.5 w-7.5 shrink-0 overflow-hidden rounded bg-surface-3">
                                <Image unoptimized={true} src={filteredShow.poster} alt="" fill sizes="30px" className="object-cover" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-fg">{filteredShow?.title ?? "This show"}</p>
                            <p className="text-[13px] text-fg-dim">{filteredShow ? filterSummary : "Not on your list, so nothing to show here yet"}</p>
                        </div>
                        <button onClick={clearShowFilter} className="cursor-pointer shrink-0 text-[13px] text-fg-dim transition-colors hover:text-fg">
                            Show all
                        </button>
                    </div>
                )}

                {/* Day strip: jumps the box below to a day. Dragged sideways with
                    the mouse like the rails on the home page. */}
                <DragScroll>
                    <nav ref={strip} data-drag-scroll-viewport aria-label="Jump to a day" className="relative -mx-2 flex gap-1.5 overflow-x-auto border-b border-line px-2 py-2 [scrollbar-width:none]">
                        {days
                            .filter((d) => d >= todayStr)
                            .map((d) => {
                                const c = episodesOn(d);
                                const active = (activeDay ?? linked ?? todayStr) === d;
                                return (
                                    <button
                                        key={d}
                                        data-day={d}
                                        onClick={() => jumpTo(d)}
                                        aria-label={`${WEEKDAY_LONG[weekdayOf(d)]} ${longDate(d)}, ${c} episode${c !== 1 ? "s" : ""}`}
                                        className={`cursor-pointer flex w-14.5 shrink-0 flex-col items-center gap-0.5 rounded-lg pt-1.5 pb-2 transition-colors hover:bg-surface-2 ${active ? "bg-surface-3" : ""} ${c ? "" : "opacity-45"}`}
                                    >
                                        <span className="text-[11px] tracking-wider text-fg-muted uppercase">{d === todayStr ? "Today" : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                                        <span className={`text-[17px] font-bold tabular-nums ${d === todayStr ? "text-primary" : active ? "text-fg" : "text-fg-soft"}`}>{Number(d.slice(8))}</span>
                                        <span className="text-[11px] tabular-nums text-fg-dim">{c ? `${c} ep${c > 1 ? "s" : ""}` : "—"}</span>
                                    </button>
                                );
                            })}
                    </nav>
                </DragScroll>

                {/* Days, in their own scroll box */}
                <div
                    ref={scroller}
                    style={{ height: scrollerHeight ?? undefined }}
                    className="relative -mx-2 -mt-5 flex h-[calc(100dvh-22rem)] min-h-105 flex-col overflow-y-auto overscroll-contain px-2 pb-6 mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-32px),transparent)]"
                >
                    {entries.length === 0 ? (
                        <div className="py-16 text-center text-fg-dim">
                            <CalendarDays className="mx-auto mb-3 h-12 w-12 opacity-30" />
                            <p className="font-medium">No upcoming episodes</p>
                            <p className="mt-1 text-sm">Add shows to your watchlist to see their schedule here</p>
                        </div>
                    ) : visibleDays.length === 0 ? (
                        <p className="py-16 text-center text-sm text-fg-dim">Nothing airing in the next {span} days</p>
                    ) : (
                        visibleDays.map((d) => {
                            const list = airingsOn(d);
                            const c = episodesOn(d);
                            const rel = relative(d);
                            if (list.length === 0)
                                return (
                                    <div key={d} id={`day-${d}`} className="flex items-baseline gap-2.5 pt-4 text-[13px] text-fg-dim">
                                        <b className="font-semibold text-fg-muted">
                                            {WEEKDAY_LONG[weekdayOf(d)]} {Number(d.slice(8))}
                                        </b>
                                        Nothing airing
                                    </div>
                                );
                            return (
                                <section key={d} id={`day-${d}`} className={`pt-7 ${d < todayStr ? "opacity-60" : ""}`}>
                                    <div className="mb-3.5 flex items-baseline justify-between gap-3">
                                        <div>
                                            <p className="text-[13px] text-fg-muted">{longDate(d)}</p>
                                            <h2 className="mt-0.5 flex items-baseline gap-2.5 text-[26px] font-bold tracking-tight text-fg">
                                                {WEEKDAY_LONG[weekdayOf(d)]}
                                                {rel && <span className="text-[13px] font-semibold tracking-normal text-primary">{rel}</span>}
                                            </h2>
                                        </div>
                                        <span className="text-[13px] tabular-nums text-fg-dim">
                                            {c} episode{c !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3.5 gap-y-4.5">{list.map(posterCard)}</div>
                                </section>
                            );
                        })
                    )}

                    <button
                        onClick={() => setSpan((s) => s + 14)}
                        className="cursor-pointer mt-8 self-center rounded-lg border border-line-strong px-3 py-2 text-sm text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                        Show 2 more weeks
                    </button>
                </div>
            </div>
        </div>
    );
}
