"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bookmark, CalendarDays, Check, ChevronUp, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import type { ScheduleEntry } from "@/actions/schedule";
import { getScheduleRefreshTargets, refreshScheduleChunk, refreshSingleShow } from "@/actions/schedule";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";
import { DragScroll } from "@/components/drag-scroll";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
// Where the day strip sticks: just under the site header once it has shrunk
// on scroll, the same line the media page's section nav sticks to.
const STICKY_TOP = 64;

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
/** "October 12 – 18, 2026", naming the second month only when it changes. */
function weekRange(from: string, to: string) {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    if (fy !== ty) return `${longDate(from)} – ${longDate(to)}`;
    return `${MONTH_NAMES[fm - 1]} ${fd} – ${fm === tm ? "" : `${MONTH_NAMES[tm - 1]} `}${td}, ${ty}`;
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
    // The page opens at its top with today as the first day, two weeks ahead
    // loading at a time as it is scrolled down. The past is opened by hand, a
    // week at a time, from a button above today: loading it on its own as the
    // page neared the top kept the page's title forever out of reach.
    const [pastDays, setPastDays] = useState(linkedOffset < 0 ? -linkedOffset : 0);
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

    // How far the schedule actually goes: loading stops at either end.
    const airDates = filtered.map((e) => e.airDate).sort();
    const earliest = airDates[0] ?? todayStr;
    const latest = airDates[airDates.length - 1] ?? todayStr;
    const canLoadPast = addDays(todayStr, -pastDays) > earliest;
    const canLoadMore = addDays(todayStr, span) <= latest;

    const days: string[] = [];
    for (let i = -pastDays; i < span; i++) days.push(addDays(todayStr, i));
    // The strip runs further ahead than the loaded days, so that today — or
    // any loaded day — can sit at its left edge with the past week tucked
    // away before it. Picking a day beyond the box loads up to it first.
    const STRIP_AHEAD = 35;
    const stripDays: string[] = [];
    for (let i = -pastDays; i < Math.max(span, STRIP_AHEAD); i++) stripDays.push(addDays(todayStr, i));
    const visibleDays = days.filter((d) => episodesOn(d) > 0 || showEmpty || d === linked);

    const isLive = (a: Airing) => !!(now && a.time && now.getTime() >= a.time.getTime() && now.getTime() < a.time.getTime() + LIVE_WINDOW_MS);
    const formatTime = (t: Date | null) => (t && now ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null);
    const relative = (d: string) => (d === todayStr ? "Today" : d === addDays(todayStr, 1) ? "Tomorrow" : d === addDays(todayStr, -1) ? "Yesterday" : null);
    const mediaHref = (e: ScheduleEntry) => `/media/${e.mediaId}?season=${e.seasonNumber}`;

    // The day itself, or the first day after it with anything on — a quiet
    // day has no section unless empty days are shown.
    const dayNode = (d: string) =>
        document.getElementById(`day-${d}`) ?? [...document.querySelectorAll<HTMLElement>("[id^='day-']")].find((n) => n.id.slice(4) >= d);
    // The days scroll with the page; only the strip above them sticks, under
    // the site header. A day "starts" where the strip ends.
    const list = useRef<HTMLDivElement>(null);
    const strip = useRef<HTMLElement>(null);
    const stripBox = useRef<HTMLDivElement>(null);
    const [stuck, setStuck] = useState(false);
    const stripBottom = () => STICKY_TOP + (stripBox.current?.offsetHeight ?? 0);

    const scrollToDay = (d: string, smooth: boolean) => {
        const node = dayNode(d);
        if (!node) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const top = node.getBoundingClientRect().top + window.scrollY - stripBottom() + 4;
        window.scrollTo({ top, behavior: smooth && !reduce ? "smooth" : "auto" });
    };
    const [pendingJump, setPendingJump] = useState<string | null>(null);
    const jumpTo = (d: string) => {
        const ahead = daysBetween(todayStr, d);
        if (ahead >= span) {
            setSpan(Math.ceil((ahead + 1) / 14) * 14);
            setPendingJump(d);
        } else scrollToDay(d, true);
    };
    useEffect(() => {
        if (!pendingJump) return;
        const frame = requestAnimationFrame(() => {
            scrollToDay(pendingJump, true);
            setPendingJump(null);
        });
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once the new days are rendered
    }, [pendingJump, span]);

    // Arriving from a countdown, open the page on the linked day.
    useEffect(() => {
        if (!linked) return;
        const frame = requestAnimationFrame(() => scrollToDay(linked, false));
        return () => cancelAnimationFrame(frame);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
    }, []);

    // The strip scrolls sideways to keep the active chip at its start, the way
    // the page keeps the active day at its top: opened past days' chips sit
    // off to the left, out of view until the page is scrolled up into them
    // (or the strip is dragged). The first placement is instant, the rest glide.
    const stripPlaced = useRef(false);
    useEffect(() => {
        const bar = strip.current;
        const chip = bar?.querySelector<HTMLElement>(`[data-day="${activeDay ?? linked ?? todayStr}"]`);
        if (!bar || !chip) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        bar.scrollTo({ left: chip.offsetLeft - 8, behavior: reduce || !stripPlaced.current ? "auto" : "smooth" });
        stripPlaced.current = true;
    }, [activeDay, linked, todayStr]);

    // The strip follows the page's scroll: the active day is the last one
    // whose section has started under the strip. Read from positions rather
    // than an IntersectionObserver, which also counted the few pixels of the
    // previous day still showing above it.
    useEffect(() => {
        const box = list.current;
        if (!box) return;
        const nodes = [...box.querySelectorAll<HTMLElement>("[id^='day-']")];
        if (!nodes.length) return;
        let frame = 0;
        const update = () => {
            frame = 0;
            if (stripBox.current) setStuck(stripBox.current.getBoundingClientRect().top <= STICKY_TOP + 1);
            const line = stripBottom();
            const rect = box.getBoundingClientRect();
            // Near the end of the days, load the next stretch of them.
            if (rect.bottom < window.innerHeight + 600 && canLoadMore) setSpan((n) => n + 14);
            // The last days can never reach the strip: at the bottom of the
            // page, the last one is the active day.
            if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) {
                setActiveDay(nodes[nodes.length - 1].id.slice(4));
                return;
            }
            let current = nodes[0];
            for (const n of nodes) {
                if (n.getBoundingClientRect().top <= line + 24) current = n;
                else break;
            }
            setActiveDay(current.id.slice(4));
        };
        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        // Also once now: a short stretch may not fill the page, or leave too
        // little above today to scroll up into.
        onScroll();
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
        };
    }, [span, pastDays, showEmpty, includePlanToWatch, asianOnly, showFilter, canLoadPast, canLoadMore]);

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
    const [refreshingShowId, setRefreshingShowId] = useState<string | null>(null);
    const handleRefreshShow = async (mediaId: string, title: string) => {
        setRefreshingShowId(mediaId);
        const toastId = toast.loading(`Refreshing ${title}…`);
        try {
            await refreshSingleShow(mediaId);
            toast.success(`${title} refreshed`, { id: toastId });
            window.location.reload();
        } catch (error) {
            console.error("Show refresh failed:", error);
            toast.error(`Failed to refresh ${title}`, { id: toastId });
        } finally {
            setRefreshingShowId(null);
        }
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
    const pastWeekEpisodes = Array.from({ length: 7 }, (_, i) => addDays(todayStr, -pastDays - 7 + i)).reduce((n, d) => n + episodesOn(d), 0);

    const posterCard = (a: Airing) => {
        const t = formatTime(a.time);
        const planned = isPlanned(a);
        const e = a.first;
        // Refetching one show's dates, the per-show action the old month grid
        // kept in its tooltips, sits on the poster's corner: shown on hover or
        // keyboard focus, and always on a touch screen, which has no hover.
        return (
            <div key={a.key} className="group relative min-w-0">
                <div className="absolute top-1.5 right-1.5 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => handleRefreshShow(e.mediaId, e.title)}
                                disabled={refreshingShowId === e.mediaId}
                                aria-label={`Refresh ${e.title}`}
                                className="cursor-pointer flex h-6 w-6 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur-sm transition-colors hover:bg-black/90 disabled:opacity-60"
                            >
                                <RefreshCw className={`h-3 w-3 ${refreshingShowId === e.mediaId ? "animate-spin" : ""}`} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Refresh this show</TooltipContent>
                    </Tooltip>
                </div>
                <Link href={mediaHref(e)} className="flex min-w-0 flex-col gap-1.5">
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
            </div>
        );
    };

    return (
        <TooltipProvider delayDuration={300}>
            <div className="min-h-screen [overflow-anchor:none]">
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

                    {/* Day strip: jumps the page to a day. Dragged sideways with the
                        mouse like the rails on the home page. Sticks under the
                        site header, solid only once stuck, like the media nav. */}
                    <div ref={stripBox} className={`sticky z-20 -mx-2 px-2 transition-colors ${stuck ? "bg-app" : "bg-transparent"}`} style={{ top: STICKY_TOP }}>
                        <DragScroll>
                            <nav ref={strip} data-drag-scroll-viewport aria-label="Jump to a day" className="relative -mx-2 flex gap-1.5 overflow-x-auto border-b border-line px-2 py-2 [scrollbar-width:none]">
                                {stripDays.map((d) => {
                                        const c = episodesOn(d);
                                        const active = (activeDay ?? linked ?? todayStr) === d;
                                        return (
                                            <button
                                                key={d}
                                                data-day={d}
                                                onClick={() => jumpTo(d)}
                                                aria-label={`${WEEKDAY_LONG[weekdayOf(d)]} ${longDate(d)}, ${c} episode${c !== 1 ? "s" : ""}`}
                                                className={`cursor-pointer flex w-14.5 shrink-0 flex-col items-center gap-0.5 rounded-lg pt-1.5 pb-2 transition-colors hover:bg-surface-2 ${active ? "bg-surface-3" : ""} ${!c ? "opacity-45" : d < todayStr ? "opacity-60" : ""}`}
                                            >
                                                <span className="text-[11px] tracking-wider text-fg-muted uppercase">{d === todayStr ? "Today" : d.endsWith("-01") ? <b className="font-semibold text-fg-soft">{MONTH_NAMES[Number(d.slice(5, 7)) - 1].slice(0, 3)}</b> : WEEKDAY_SHORT[weekdayOf(d)]}</span>
                                                <span className={`text-[17px] font-bold tabular-nums ${d === todayStr ? "text-primary" : active ? "text-fg" : "text-fg-soft"}`}>{Number(d.slice(8))}</span>
                                                <span className="text-[11px] tabular-nums text-fg-dim">{c ? `${c} ep${c > 1 ? "s" : ""}` : "—"}</span>
                                            </button>
                                        );
                                })}
                            </nav>
                        </DragScroll>
                    </div>

                    {/* Days, scrolled by the page */}
                    <div ref={list} className="-mt-5 flex flex-col pb-6">
                        {/* Opens the week before the earliest day shown, set like a
                            day's own heading — its dates above, its count to the
                            right — so it reads as part of the list rather than a
                            control bolted onto it. The days appear under it while
                            the view stays put: the feed's root turns scroll
                            anchoring off, which would otherwise hold today in
                            place and jump. */}
                        {canLoadPast && entries.length > 0 && (
                            <button onClick={() => setPastDays((p) => p + 7)} className="group/past cursor-pointer pt-7 text-left">
                                <span className="flex items-baseline justify-between gap-3">
                                    <span className="text-[13px] text-fg-muted">{weekRange(addDays(todayStr, -pastDays - 7), addDays(todayStr, -pastDays - 1))}</span>
                                    <span className="text-[13px] tabular-nums text-fg-dim">
                                        {pastWeekEpisodes} episode{pastWeekEpisodes !== 1 ? "s" : ""}
                                    </span>
                                </span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[20px] font-bold tracking-tight text-fg-soft transition-colors group-hover/past:text-fg">
                                    <ChevronUp className="h-5 w-5 transition-transform group-hover/past:-translate-y-0.5" />
                                    {pastDays === 0 ? "Show the past week" : "Show the week before"}
                                </span>
                            </button>
                        )}
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

                        {!canLoadMore && visibleDays.length > 0 && (
                            <p className="mt-8 self-center text-[13px] text-fg-dim">Nothing scheduled after {longDate(latest)}</p>
                        )}
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
