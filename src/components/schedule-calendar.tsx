"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, SlidersHorizontal, RefreshCw, Check, Filter, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduleEntry } from "@/actions/schedule";
import { getScheduleRefreshTargets, refreshScheduleChunk, refreshSingleShow } from "@/actions/schedule";
import { toast } from "sonner";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";

export type { ScheduleEntry };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function ScheduleCalendar({
    entries,
    initialDate,
    initialShow,
    initialPrefs,
}: {
    entries: ScheduleEntry[];
    initialDate?: string;
    /** A `mediaId` from `?show=` — the media page links here already narrowed. */
    initialShow?: string;
    initialPrefs?: CalendarPreferences;
}) {
    const today = new Date();
    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    // Parse "YYYY-MM-DD" param — derive initial month and highlighted date
    const parseInitial = () => {
        if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
            const [y, m] = initialDate.split("-").map(Number);
            if (!isNaN(y) && m >= 1 && m <= 12) return { y, m: m - 1 };
        }

        // A show was named but no date. Landing on the current month would show
        // an empty grid for anything airing later, which is the opposite of what
        // following a link to one show's schedule is for — so open on the month
        // of its next episode, or of its last one if the run is over.
        if (initialShow) {
            const mine = entries.filter((e) => e.mediaId === initialShow).sort((a, b) => (a.airDate < b.airDate ? -1 : 1));
            const anchor = mine.find((e) => e.airDate >= todayStr) ?? mine[mine.length - 1];
            if (anchor) {
                const [y, m] = anchor.airDate.split("-").map(Number);
                if (!isNaN(y) && m >= 1 && m <= 12) return { y, m: m - 1 };
            }
        }

        return { y: today.getFullYear(), m: today.getMonth() };
    };
    const initial = parseInitial();

    const [year, setYear] = useState(initial.y);
    const [month, setMonth] = useState(initial.m);
    const [asianOnly, setAsianOnly] = useState(initialPrefs?.calendarAsianOnly ?? false);
    const [includePlanToWatch, setIncludePlanToWatch] = useState(initialPrefs?.calendarIncludePlanToWatch ?? true);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshingShowId, setRefreshingShowId] = useState<string | null>(null);
    // Narrowing to one show. Held as state rather than read from the URL on
    // every render because every entry is already here — filtering is a local
    // operation, and a round trip to the server would only re-fetch what the
    // page is holding.
    const [showFilter, setShowFilter] = useState<string | null>(initialShow ?? null);

    // Taken from the unfiltered set: the filter itself has to keep naming the
    // show even on a month where it has nothing.
    const filteredShow = showFilter ? entries.find((e) => e.mediaId === showFilter) : undefined;

    // The URL is kept in step by hand rather than through the router: the page
    // is force-dynamic, so a replace() would re-run the whole schedule query to
    // change a query string the client has already acted on.
    const writeShowParam = (mediaId: string | null) => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (mediaId) url.searchParams.set("show", mediaId);
        else url.searchParams.delete("show");
        window.history.replaceState({}, "", url);
    };

    const applyShowFilter = (mediaId: string | null) => {
        setShowFilter(mediaId);
        writeShowParam(mediaId);
    };

    const ASIAN_COUNTRIES = ["KR", "CN", "JP", "TW", "TH", "HK"];
    const filteredEntries = entries
        .filter((e) => !showFilter || e.mediaId === showFilter)
        // The region and plan-to-watch filters are about thinning a crowded
        // month. One show is not a crowd, and letting them hide the very show
        // just asked for would read as the link being broken.
        .filter((e) => showFilter || !asianOnly || ASIAN_COUNTRIES.includes(e.originCountry))
        .filter((e) => showFilter || includePlanToWatch || e.status !== "Plan to Watch");

    const handleRefreshShow = async (mediaId: string) => {
        setRefreshingShowId(mediaId);
        try {
            await refreshSingleShow(mediaId);
            window.location.reload();
        } finally {
            setRefreshingShowId(null);
        }
    };

    // Driven from here in chunks so the count can be reported as it goes. The
    // menu closes on click, which used to hide the only sign anything was
    // happening — a toast says it from outside the menu, and says how far along.
    const REFRESH_CHUNK = 4;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setShowActionsMenu(false);
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

    const goToPrev = () => {
        if (month === 0) {
            setYear((y) => y - 1);
            setMonth(11);
        } else setMonth((m) => m - 1);
    };
    const goToNext = () => {
        if (month === 11) {
            setYear((y) => y + 1);
            setMonth(0);
        } else setMonth((m) => m + 1);
    };
    const goToToday = () => {
        setYear(today.getFullYear());
        setMonth(today.getMonth());
    };

    // Map airDate -> (mediaId -> episodes[]) — one icon per show per day
    const byDate = new Map<string, Map<string, ScheduleEntry[]>>();
    for (const entry of filteredEntries) {
        if (!byDate.has(entry.airDate)) byDate.set(entry.airDate, new Map());
        const byShow = byDate.get(entry.airDate)!;
        if (!byShow.has(entry.mediaId)) byShow.set(entry.mediaId, []);
        byShow.get(entry.mediaId)!.push(entry);
    }

    // Build calendar cells (Monday-based)
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7; // 0=Mon
    const prevMonthDays = new Date(year, month, 0).getDate();

    type Cell = { day: number; month: number; year: number; current: boolean };
    const cells: Cell[] = [];

    for (let i = startOffset - 1; i >= 0; i--) {
        const m = month === 0 ? 11 : month - 1;
        const y = month === 0 ? year - 1 : year;
        cells.push({ day: prevMonthDays - i, month: m, year: y, current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month, year, current: true });
    }
    const trailing = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= trailing; d++) {
        const m = month === 11 ? 0 : month + 1;
        const y = month === 11 ? year + 1 : year;
        cells.push({ day: d, month: m, year: y, current: false });
    }

    const thisMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const episodesThisMonth = filteredEntries.filter((e) => e.airDate.startsWith(thisMonthPrefix)).length;

    return (
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* The month is the title. It used to be boxed on the right as
                        if it were a secondary control, while the heading said
                        "Calendar" — which the navigation already says, and which
                        never changes. The one thing on this page that does change
                        is which month you are looking at, so that is the heading,
                        and the count below it follows along. */}
                    <div>
                        <h1 className="font-display text-3xl font-bold text-fg">
                            {MONTH_NAMES[month]} {year}
                        </h1>
                        <p className="text-sm text-fg-muted">
                            {episodesThisMonth > 0
                                ? `${episodesThisMonth} episode${episodesThisMonth !== 1 ? "s" : ""} airing`
                                : "Nothing airing this month"}
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2">
                        {/* Filters menu */}
                        <div className="relative">
                            {/* This one does have a state worth showing — a filter
                                is on, or the menu is open — so it keeps a fill when
                                that is true, and is a bare icon the rest of the
                                time. */}
                            <button
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                aria-label="Filters"
                                className={`cursor-pointer h-9 w-9 rounded-lg flex items-center justify-center transition-colors ${showActionsMenu || asianOnly || !includePlanToWatch ? "bg-primary/20 text-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg"}`}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                            </button>
                            {showActionsMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                                    <div className="absolute top-full mt-2 right-0 z-20 bg-panel/95 backdrop-blur-xl border border-line-strong rounded-lg shadow-2xl shadow-black/50 p-2 min-w-52 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <p className="px-3 py-1.5 text-xs font-semibold text-fg-dim uppercase tracking-wider">Region</p>
                                        <button
                                            onClick={() => { setAsianOnly(false); saveCalendarPreferences({ calendarAsianOnly: false }); }}
                                            className="cursor-pointer w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-fg-soft hover:bg-surface-3 hover:text-fg transition-colors"
                                        >
                                            All shows
                                            {!asianOnly && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                        <button
                                            onClick={() => { setAsianOnly(true); saveCalendarPreferences({ calendarAsianOnly: true }); }}
                                            className="cursor-pointer w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-fg-soft hover:bg-surface-3 hover:text-fg transition-colors"
                                        >
                                            Asian shows only
                                            {asianOnly && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                        <div className="my-1.5 border-t border-line-strong" />
                                        <p className="px-3 py-1.5 text-xs font-semibold text-fg-dim uppercase tracking-wider">Show</p>
                                        <button
                                            onClick={() => { const next = !includePlanToWatch; setIncludePlanToWatch(next); saveCalendarPreferences({ calendarIncludePlanToWatch: next }); }}
                                            className="cursor-pointer w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-fg-soft hover:bg-surface-3 hover:text-fg transition-colors"
                                        >
                                            Plan to Watch
                                            {includePlanToWatch && <Check className="h-3.5 w-3.5 text-primary" />}
                                        </button>
                                        <div className="my-1.5 border-t border-line-strong" />
                                        <button
                                            onClick={handleRefresh}
                                            disabled={isRefreshing}
                                            className="cursor-pointer w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-fg-soft hover:bg-surface-3 hover:text-fg transition-colors disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 text-blue-400 ${isRefreshing ? "animate-spin" : ""}`} />
                                            {isRefreshing ? "Refreshing..." : "Refresh schedule"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* The label moved into the heading, so what is left here is
                            two ways to move and one shortcut. They no longer need a
                            box each: nothing here has an active state to show, which
                            is the only thing a frame around a control buys. */}
                        <button
                            onClick={goToToday}
                            className="cursor-pointer px-2 py-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
                        >
                            Today
                        </button>
                        <div className="flex items-center">
                            <button
                                onClick={goToPrev}
                                aria-label="Previous month"
                                className="cursor-pointer p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={goToNext}
                                aria-label="Next month"
                                className="cursor-pointer p-2 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* The active show filter, when there is one. Stated as a bar
                    rather than a chip tucked in the header: arriving here from a
                    show's page means the grid is deliberately near-empty, and
                    that needs saying somewhere the eye lands before it reads the
                    emptiness as a bug. */}
                {showFilter && (
                    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        {filteredShow?.poster ? (
                            <div className="relative h-9 w-6.5 shrink-0 overflow-hidden rounded bg-surface-3">
                                <Image unoptimized={true} src={filteredShow.poster} alt="" fill sizes="26px" className="object-cover" />
                            </div>
                        ) : (
                            <Filter className="h-4 w-4 shrink-0 text-primary" />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-fg">
                                {filteredShow?.title ?? "This show"}
                            </p>
                            <p className="text-xs text-fg-muted">
                                {filteredShow
                                    ? "Showing this show only"
                                    : "Not on your list — nothing to show here yet"}
                            </p>
                        </div>
                        <button
                            onClick={() => applyShowFilter(null)}
                            className="cursor-pointer flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
                        >
                            <X className="h-3.5 w-3.5" />
                            Show all
                        </button>
                    </div>
                )}

                {/* Calendar */}
                <div className="rounded-lg border border-line-strong overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 bg-surface-2 border-b border-line-strong">
                        {DAY_HEADERS.map((day, i) => (
                            <div
                                key={day}
                                className={`py-3 text-center text-xs font-semibold tracking-wider ${i >= 5 ? "text-fg-dim" : "text-fg-muted"}`}
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Cells */}
                    <TooltipProvider delayDuration={200}>
                        <div className="grid grid-cols-7">
                            {cells.map((cell, i) => {
                                const dateStr = toDateStr(cell.year, cell.month, cell.day);
                                // Group by show: one icon per show per day
                                const dayGroups = byDate.has(dateStr) ? [...byDate.get(dateStr)!.values()] : [];
                                const isToday = dateStr === todayStr;
                                const isHighlighted = initialDate ? dateStr === initialDate : false;
                                const isPast = dateStr < todayStr;
                                const colIndex = i % 7;
                                const isWeekend = colIndex === 5 || colIndex === 6;
                                const isLastRow = i >= cells.length - 7;
                                const isLastCol = colIndex === 6;

                                return (
                                    <div
                                        key={i}
                                        className={[
                                            "min-h-28 p-2 flex flex-col gap-1.5 transition-colors",
                                            !isLastRow ? "border-b border-line-soft" : "",
                                            !isLastCol ? "border-r border-line-soft" : "",
                                            !cell.current ? "opacity-20" : "",
                                            cell.current && isPast && !isToday ? "opacity-50" : "",
                                            cell.current && isWeekend && !isHighlighted ? "bg-surface-1.5" : "",
                                            cell.current && isToday && !isHighlighted ? "bg-primary/5" : "",
                                            cell.current && isHighlighted ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/30" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                    >
                                        {/* Day number */}
                                        <div className="flex justify-center">
                                            <span
                                                className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                                                    isToday ? "text-primary" : cell.current ? "text-fg-soft" : "text-fg-faint"
                                                }`}
                                            >
                                                {cell.day}
                                            </span>
                                        </div>

                                        {/* Episode icons — one per show */}
                                        {dayGroups.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5 justify-center">
                                                {dayGroups.slice(0, 4).map((showEps, gi) => {
                                                    const first = showEps[0];
                                                    // Plan-to-watch shows are optional viewing the user
                                                    // has only earmarked — when they are mixed in with
                                                    // what's actually being watched the day fills up
                                                    // fast, so they sit back: greyed and dimmed, with
                                                    // a dashed ring in place of the solid page-coloured
                                                    // one.
                                                    const isPlanToWatch = first.status === "Plan to Watch";
                                                    return (
                                                        <Tooltip key={gi}>
                                                            <TooltipTrigger asChild>
                                                                <Link href={`/media/${first.mediaId}?season=${first.seasonNumber}`}>
                                                                    <div className={`relative w-8 h-8 rounded-full overflow-hidden ring-2 hover:ring-primary/70 hover:scale-110 transition-all bg-surface-3 shrink-0 ${isPlanToWatch ? "ring-transparent outline-2 outline-dashed outline-offset-1 outline-fg-dim/60" : "ring-page"}`}>
                                                                        {first.poster ? (
                                                                            <Image unoptimized={true}
                                                                                src={first.poster}
                                                                                alt={first.title}
                                                                                fill
                                                                                sizes="32px"
                                                                                className={`object-cover object-top ${isPlanToWatch ? "opacity-45 grayscale" : ""}`}
                                                                            />
                                                                        ) : (
                                                                            <div className={`w-full h-full flex items-center justify-center text-[10px] font-bold text-fg-muted ${isPlanToWatch ? "opacity-45" : ""}`}>
                                                                                {first.title.slice(0, 2).toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <div className="flex items-center justify-between gap-3 mb-1">
                                                                    <p className="font-semibold">
                                                                        {first.title}
                                                                        {isPlanToWatch && (
                                                                            <span className="ml-2 font-normal text-fg-dim text-xs">Plan to Watch</span>
                                                                        )}
                                                                    </p>
                                                                    <div className="flex shrink-0 items-center gap-2">
                                                                        {/* The other half of the filter: the
                                                                            media page links in already narrowed,
                                                                            and this is how you narrow from
                                                                            inside a busy month. */}
                                                                        {!showFilter && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.preventDefault();
                                                                                    e.stopPropagation();
                                                                                    applyShowFilter(first.mediaId);
                                                                                }}
                                                                                className="cursor-pointer text-fg-muted hover:text-fg transition-colors"
                                                                                title="Show only this"
                                                                            >
                                                                                <Filter className="h-3 w-3" />
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                handleRefreshShow(first.mediaId);
                                                                            }}
                                                                            disabled={refreshingShowId === first.mediaId}
                                                                            className="cursor-pointer text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
                                                                            title="Refresh this show"
                                                                        >
                                                                            <RefreshCw className={`h-3 w-3 ${refreshingShowId === first.mediaId ? "animate-spin" : ""}`} />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {/* "S01E23" is a western-TV habit that fits almost nothing
                                                                    here: MDL files each season as its own entry and Asian
                                                                    dramas are overwhelmingly single-season, so the season
                                                                    only earns its place when there is more than one — the
                                                                    same rule the watchlist badge and the media links use. */}
                                                                {showEps.map((ep, ei) => (
                                                                    <p key={ei} className="text-fg-muted text-xs">
                                                                        {ep.seasonNumber > 1 ? `S${ep.seasonNumber} · ` : ""}
                                                                        Episode {ep.episodeNumber}
                                                                        {ep.episodeName ? ` · ${ep.episodeName}` : ""}
                                                                    </p>
                                                                ))}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })}
                                                {dayGroups.length > 4 && (
                                                    <div className="w-8 h-8 rounded-full bg-surface-4 border border-line-strong flex items-center justify-center text-[10px] font-bold text-fg-soft shrink-0">
                                                        +{dayGroups.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </TooltipProvider>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 text-xs text-fg-dim">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-primary/5 flex items-center justify-center text-primary font-semibold text-[10px]">
                            7
                        </span>
                        <span>Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-amber-500/10 ring-1 ring-inset ring-amber-500/30" />
                        <span>Linked date</span>
                    </div>
                    {includePlanToWatch && (
                        <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-surface-3 opacity-45 outline-2 outline-dashed outline-offset-1 outline-fg-dim/60" />
                            <span>Plan to Watch</span>
                        </div>
                    )}
                </div>

                {filteredEntries.length === 0 && (
                    <div className="text-center py-16 text-fg-dim">
                        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        {showFilter ? (
                            // The generic "add shows to your watchlist" is wrong
                            // here twice over: the reader arrived from a show's
                            // own page, and the calendar is built from tracked
                            // shows, so the thing to say is which of those two
                            // did not hold.
                            <>
                                <p className="font-medium">No dated episodes for this show</p>
                                <p className="text-sm mt-1">
                                    The calendar only covers shows on your list, and only once a source has dated them.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium">No upcoming episodes</p>
                                <p className="text-sm mt-1">Add shows to your watchlist to see their schedule here</p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
