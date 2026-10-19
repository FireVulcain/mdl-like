"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays, SlidersHorizontal, RefreshCw, Check, Filter } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduleEntry } from "@/actions/schedule";
import { getScheduleRefreshTargets, refreshScheduleChunk, refreshSingleShow } from "@/actions/schedule";
import { toast } from "sonner";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";

export type { ScheduleEntry };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const WEEKDAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
const PLAN_TO_WATCH = "Plan to Watch";

function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday-first weekday index of a YYYY-MM-DD string. */
function weekdayOf(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** "Episode 4", "Episodes 3 & 4", "Episodes 1–8" — with the season only when there is more than one. */
function episodeLabel(eps: ScheduleEntry[]) {
    const nums = eps.map((e) => e.episodeNumber).sort((a, b) => a - b);
    const season = eps[0].seasonNumber > 1 ? `S${eps[0].seasonNumber} · ` : "";
    if (nums.length === 1) return `${season}Episode ${nums[0]}`;
    if (nums.length === 2) return `${season}Episodes ${nums[0]} & ${nums[1]}`;
    return `${season}Episodes ${nums[0]}–${nums[nums.length - 1]}`;
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

    const parseInitial = () => {
        if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
            const [y, m] = initialDate.split("-").map(Number);
            if (!isNaN(y) && m >= 1 && m <= 12) return { y, m: m - 1 };
        }

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
    // A linked date (`?date=`) opens selected, so the panel already shows it.
    const [selectedDate, setSelectedDate] = useState<string | null>(initialDate ?? null);
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [asianOnly, setAsianOnly] = useState(initialPrefs?.calendarAsianOnly ?? false);
    const [includePlanToWatch, setIncludePlanToWatch] = useState(initialPrefs?.calendarIncludePlanToWatch ?? true);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshingShowId, setRefreshingShowId] = useState<string | null>(null);
    const [showFilter, setShowFilter] = useState<string | null>(initialShow ?? null);

    const filteredShow = showFilter ? entries.find((e) => e.mediaId === showFilter) : undefined;

    const writeShowParam = (mediaId: string | null) => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (mediaId) url.searchParams.set("show", mediaId);
        else url.searchParams.delete("show");
        window.history.replaceState({}, "", url);
    };

    const [openTooltip, setOpenTooltip] = useState<string | null>(null);

    const applyShowFilter = (mediaId: string | null) => {
        setShowFilter(mediaId);
        writeShowParam(mediaId);
    };

    const ASIAN_COUNTRIES = ["KR", "CN", "JP", "TW", "TH", "HK"];
    const filteredEntries = entries
        .filter((e) => !showFilter || e.mediaId === showFilter)
        .filter((e) => showFilter || !asianOnly || ASIAN_COUNTRIES.includes(e.originCountry))
        .filter((e) => showFilter || includePlanToWatch || e.status !== PLAN_TO_WATCH);

    const handleRefreshShow = async (mediaId: string) => {
        setRefreshingShowId(mediaId);
        try {
            await refreshSingleShow(mediaId);
            window.location.reload();
        } finally {
            setRefreshingShowId(null);
        }
    };

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
        setSelectedDate(todayStr);
    };

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const thisMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthEntries = filteredEntries.filter((e) => e.airDate.startsWith(thisMonthPrefix));
    const episodesThisMonth = monthEntries.length;
    const monthDates = Array.from({ length: daysInMonth }, (_, i) => toDateStr(year, month, i + 1));

    // The day the panel shows: the one picked, if it is in this month;
    // otherwise today, if today is; otherwise the first day with anything on
    // it. Derived rather than stored, so paging months never leaves the panel
    // describing a day that is no longer on screen.
    const panelDate = (() => {
        if (selectedDate?.startsWith(thisMonthPrefix)) return selectedDate;
        if (todayStr.startsWith(thisMonthPrefix)) return todayStr;
        const first = monthEntries.map((e) => e.airDate).sort()[0];
        return first ?? `${thisMonthPrefix}-01`;
    })();

    const filterSummary = (() => {
        if (!filteredShow) return null;
        const mine = entries.filter((e) => e.mediaId === showFilter);
        const weekdays = [...new Set(mine.map((e) => weekdayOf(e.airDate)))].sort((a, b) => a - b);
        const names = weekdays.map((d) => WEEKDAY_SHORT[d]);
        const days =
            names.length === 0 ? null
            : names.length === 1 ? names[0]
            : names.length <= 3 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
            : "Several days a week";

        const eps = mine.filter((e) => e.airDate.startsWith(thisMonthPrefix)).map((e) => e.episodeNumber).sort((a, b) => a - b);
        const inMonth =
            eps.length === 0 ? "nothing this month"
            : eps.length === 1 || eps[0] === eps[eps.length - 1] ? `episode ${eps[0]} this month`
            : `episodes ${eps[0]} to ${eps[eps.length - 1]} this month`;

        return days ? `${days} · ${inMonth}` : inMonth;
    })();

    // The two actions every show carries wherever it appears: narrow the
    // calendar to it, and refetch its dates.
    const showActions = (mediaId: string) => (
        <div className="flex shrink-0 items-center gap-2">
            {!showFilter && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyShowFilter(mediaId);
                    }}
                    className="cursor-pointer text-fg-muted hover:text-fg transition-colors"
                    title="Show only this"
                    aria-label="Show only this"
                >
                    <Filter className="h-3 w-3" />
                </button>
            )}
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRefreshShow(mediaId);
                }}
                disabled={refreshingShowId === mediaId}
                className="cursor-pointer text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
                title="Refresh this show"
                aria-label="Refresh this show"
            >
                <RefreshCw className={`h-3 w-3 ${refreshingShowId === mediaId ? "animate-spin" : ""}`} />
            </button>
        </div>
    );

    const showTooltip = (tooltipKey: string, showEps: ScheduleEntry[], trigger: ReactNode) => {
        const first = showEps[0];
        return (
            <Tooltip
                key={tooltipKey}
                open={openTooltip === tooltipKey}
                onOpenChange={(open) => setOpenTooltip((prev) => (open ? tooltipKey : prev === tooltipKey ? null : prev))}
            >
                <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                <TooltipContent side="top">
                    <div className="flex items-center justify-between gap-3 mb-1">
                        <p className="font-semibold">
                            {first.title}
                            {first.status === PLAN_TO_WATCH && <span className="ml-2 font-normal text-fg-dim text-xs">Plan to Watch</span>}
                        </p>
                        {showActions(first.mediaId)}
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
    };

    // ---- Timeline: one row per show, one column per day ----
    type Row = { mediaId: string; first: ScheduleEntry; firstDate: string; byDay: Map<string, ScheduleEntry[]> };
    const rowsById = new Map<string, Row>();
    for (const e of monthEntries) {
        let row = rowsById.get(e.mediaId);
        if (!row) {
            row = { mediaId: e.mediaId, first: e, firstDate: e.airDate, byDay: new Map() };
            rowsById.set(e.mediaId, row);
        }
        if (e.airDate < row.firstDate) row.firstDate = e.airDate;
        if (!row.byDay.has(e.airDate)) row.byDay.set(e.airDate, []);
        row.byDay.get(e.airDate)!.push(e);
    }
    // Ordered by the first episode in the month, so the grid reads as a
    // staircase of premieres rather than an alphabet.
    const rows = [...rowsById.values()].sort((a, b) => (a.firstDate === b.firstDate ? a.first.title.localeCompare(b.first.title) : a.firstDate < b.firstDate ? -1 : 1));
    // Shows being watched come first everywhere: they are what the page is
    // for, and Plan to Watch is the part that can wait.
    const rowGroups = [
        { label: "Watching", rows: rows.filter((r) => r.first.status !== PLAN_TO_WATCH) },
        { label: "Plan to Watch", rows: rows.filter((r) => r.first.status === PLAN_TO_WATCH) },
    ].filter((g) => g.rows.length > 0);

    // Colour is kept for state: the selected day is the one accent on the
    // page, today is a quieter tint of it, weekends a neutral shade.
    const columnTint = (dateStr: string) =>
        dateStr === panelDate ? "bg-primary/12"
        : dateStr === todayStr ? "bg-primary/5"
        : weekdayOf(dateStr) >= 5 ? "bg-surface-1"
        : "";

    const timeline = (
        <div className="overflow-x-auto rounded-lg border border-line-strong">
            <div
                className="grid min-w-max"
                style={{ gridTemplateColumns: `minmax(150px, 220px) repeat(${daysInMonth}, minmax(24px, 1fr))` }}
                onMouseLeave={() => setHoveredRow(null)}
            >
                <div className="sticky left-0 z-10 flex items-end bg-[color-mix(in_srgb,var(--page-bg)_95%,var(--fg))] border-b border-line-strong px-3 py-2 text-xs font-semibold tracking-wider text-fg-muted">
                    SHOW
                </div>
                {monthDates.map((dateStr, i) => (
                    <button
                        key={dateStr}
                        onClick={() => setSelectedDate(dateStr)}
                        aria-pressed={dateStr === panelDate}
                        aria-label={`${WEEKDAY_LONG[weekdayOf(dateStr)]} ${MONTH_NAMES[month]} ${i + 1}`}
                        className={`cursor-pointer border-b border-line-strong bg-surface-2 py-1.5 text-center transition-colors hover:bg-surface-4 ${columnTint(dateStr)}`}
                    >
                        <span className="block text-[10px] text-fg-dim">{WEEKDAY_LETTER[weekdayOf(dateStr)]}</span>
                        <span
                            className={`block text-xs font-semibold tabular-nums ${dateStr === panelDate || dateStr === todayStr ? "text-primary" : "text-fg-soft"}`}
                        >
                            {i + 1}
                        </span>
                    </button>
                ))}

                {rowGroups.map((group) => (
                    <div key={group.label} className="contents">
                        <div className="col-span-full px-3 pt-3.5 pb-1.5 text-[11px] font-semibold tracking-wider text-fg-muted uppercase">
                            {group.label} · {group.rows.length}
                        </div>
                        {group.rows.map((row) => {
                            const isPlanToWatch = row.first.status === PLAN_TO_WATCH;
                            const isHovered = hoveredRow === row.mediaId;
                            return (
                                <div key={row.mediaId} className="contents" onMouseEnter={() => setHoveredRow(row.mediaId)}>
                                    <Link
                                        href={`/media/${row.mediaId}?season=${row.first.seasonNumber}`}
                                        className={`sticky left-0 z-10 flex min-w-0 items-center gap-2.5 border-t border-line-soft px-3 py-1.5 ${isHovered ? "bg-[color-mix(in_srgb,var(--page-bg)_93%,var(--fg))]" : "bg-page"}`}
                                    >
                                        <div className="relative h-7.5 w-5 shrink-0 overflow-hidden rounded-sm bg-surface-3">
                                            {row.first.poster && <Image unoptimized={true} src={row.first.poster} alt="" fill sizes="20px" className="object-cover" />}
                                        </div>
                                        <span className={`truncate text-[13px] ${isPlanToWatch ? "text-fg-muted" : "font-medium text-fg"}`}>{row.first.title}</span>
                                    </Link>
                                    {monthDates.map((dateStr) => {
                                        const eps = row.byDay.get(dateStr);
                                        const nums = eps?.map((e) => e.episodeNumber).sort((a, b) => a - b);
                                        const tooltipKey = `${dateStr}:${row.mediaId}`;
                                        return (
                                            <div
                                                key={dateStr}
                                                className={`flex items-center justify-center border-t border-line-soft ${isHovered ? "bg-surface-2" : columnTint(dateStr)}`}
                                            >
                                                {eps && nums &&
                                                    showTooltip(
                                                        tooltipKey,
                                                        eps,
                                                        // Watching is a filled square, Plan to Watch an
                                                        // outline — the difference is shape, not colour.
                                                        // Several episodes the same day (a double bill, a
                                                        // whole season dropped at once) draw as a stack.
                                                        //
                                                        // The episode number only shows in the selected
                                                        // day's column: everywhere else it competed with
                                                        // the day numbers above for no gain, since the
                                                        // question the grid answers is when, not which.
                                                        // A premiere carries a dot — the one thing worth
                                                        // seeing without a click.
                                                        <button
                                                            onClick={() => setSelectedDate(dateStr)}
                                                            onPointerEnter={() => setOpenTooltip((prev) => (prev ? tooltipKey : prev))}
                                                            aria-label={`${row.first.title}, ${episodeLabel(eps)}${nums[0] === 1 ? ", premiere" : ""}`}
                                                            className={[
                                                                "relative cursor-pointer flex items-center justify-center text-[10px] font-bold tabular-nums transition-[transform,width,height] hover:scale-115",
                                                                dateStr === panelDate ? "h-5.5 w-5.5 rounded-[5px]" : "h-3.5 w-3.5 rounded-[4px]",
                                                                isPlanToWatch ? "border border-fg-dim text-fg-muted" : "bg-fg-soft text-page",
                                                                nums.length > 1
                                                                    ? isPlanToWatch
                                                                        ? "shadow-[2px_-2px_0_-1px_var(--page-bg),3px_-3px_0_-1px_var(--fg-dim)]"
                                                                        : "shadow-[2px_-2px_0_-1px_var(--page-bg),3px_-3px_0_-1px_var(--fg-soft)]"
                                                                    : "",
                                                                dateStr < todayStr && dateStr !== panelDate ? "opacity-40" : "",
                                                            ].join(" ")}
                                                        >
                                                            {dateStr === panelDate && nums[0]}
                                                            {nums[0] === 1 && (
                                                                <span className="absolute -top-1 -left-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-page" />
                                                            )}
                                                        </button>
                                                    )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}

                {rows.length === 0 && (
                    <div className="col-span-full px-3 py-10 text-center text-sm text-fg-dim">Nothing airing this month</div>
                )}
            </div>
        </div>
    );

    // ---- Panel: everything airing on the selected day ----
    const panelGroups = [...(monthEntries.reduce((acc, e) => {
        if (e.airDate !== panelDate) return acc;
        if (!acc.has(e.mediaId)) acc.set(e.mediaId, []);
        acc.get(e.mediaId)!.push(e);
        return acc;
    }, new Map<string, ScheduleEntry[]>())).values()];
    const panelWatching = panelGroups.filter((g) => g[0].status !== PLAN_TO_WATCH);
    const panelPlanned = panelGroups.filter((g) => g[0].status === PLAN_TO_WATCH);
    const [, pm, pd] = panelDate.split("-").map(Number);

    const panelItem = (showEps: ScheduleEntry[]) => {
        const first = showEps[0];
        const isPlanToWatch = first.status === PLAN_TO_WATCH;
        return (
            <div key={first.mediaId} className="-m-1 flex items-center gap-3 rounded-md p-1 transition-colors hover:bg-surface-2">
                <Link href={`/media/${first.mediaId}?season=${first.seasonNumber}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="relative h-15 w-10 shrink-0 overflow-hidden rounded bg-surface-3">
                        {first.poster ? (
                            <Image unoptimized={true} src={first.poster} alt="" fill sizes="40px" className="object-cover" />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-fg-muted">{first.title.slice(0, 2).toUpperCase()}</div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className={`truncate text-sm ${isPlanToWatch ? "font-medium text-fg-soft" : "font-semibold text-fg"}`}>{first.title}</p>
                        <p className="truncate text-xs text-fg-muted">
                            {episodeLabel(showEps)}
                            {showEps.length === 1 && first.episodeName ? ` · ${first.episodeName}` : ""}
                        </p>
                    </div>
                </Link>
                {showActions(first.mediaId)}
            </div>
        );
    };

    const panel = (
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4.5 rounded-lg bg-box p-5 lg:sticky lg:top-4 lg:max-w-80">
            <div>
                <p className="text-[13px] text-fg-muted">
                    {WEEKDAY_LONG[weekdayOf(panelDate)]}
                    {panelDate === todayStr ? " · today" : ""}
                </p>
                <h2 className="mt-0.5 text-[22px] font-bold text-fg">
                    {MONTH_NAMES[pm - 1]} {pd}
                </h2>
                <p className="mt-1 text-[13px] text-fg-muted">
                    {panelGroups.length === 0
                        ? "Nothing airing this day"
                        : `${panelGroups.length} show${panelGroups.length !== 1 ? "s" : ""}${panelPlanned.length > 0 && panelWatching.length > 0 ? ` · ${panelWatching.length} you watch` : ""}`}
                </p>
            </div>
            {panelWatching.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    {panelPlanned.length > 0 && <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">Watching</p>}
                    {panelWatching.map(panelItem)}
                </div>
            )}
            {panelPlanned.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    <p className="text-[11px] font-semibold tracking-wider text-fg-muted uppercase">Plan to Watch</p>
                    {panelPlanned.map(panelItem)}
                </div>
            )}
        </aside>
    );

    return (
        <div className="min-h-screen bg-linear-to-b ">
            {/* Wider than the other pages: a month of day columns and the day
                panel have to sit side by side without the timeline scrolling. */}
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-352">
                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* The month is the title: the one thing on this page that
                        changes is which month you are looking at. */}
                    <div>
                        <h1 className="font-display text-3xl font-bold text-fg">
                            {MONTH_NAMES[month]} {year}
                        </h1>
                        <p className="text-sm text-fg-muted">
                            {episodesThisMonth > 0
                                ? `${rows.length} show${rows.length !== 1 ? "s" : ""} · ${episodesThisMonth} episode${episodesThisMonth !== 1 ? "s" : ""} airing`
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

                {/* The active show filter, when there is one. Stated in a box
                    rather than a chip tucked in the header: arriving here from a
                    show's page means the grid is deliberately near-empty, and
                    that needs saying somewhere the eye lands before it reads the
                    emptiness as a bug. */}
                {showFilter && (
                    <div className="flex items-center gap-3.5 rounded-lg bg-box px-4 py-3">
                        {filteredShow?.poster && (
                            <div className="relative h-10.5 w-7.5 shrink-0 overflow-hidden rounded bg-surface-3">
                                <Image unoptimized={true} src={filteredShow.poster} alt="" fill sizes="30px" className="object-cover" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold text-fg">
                                {filteredShow?.title ?? "This show"}
                            </p>
                            <p className="text-[13px] text-fg-dim">
                                {filterSummary ?? "Not on your list, so nothing to show here yet"}
                            </p>
                        </div>
                        <button
                            onClick={() => applyShowFilter(null)}
                            className="cursor-pointer shrink-0 text-[13px] text-fg-dim transition-colors hover:text-fg"
                        >
                            Show all
                        </button>
                    </div>
                )}

                {filteredEntries.length > 0 && (
                    <div className="flex flex-wrap items-start gap-6">
                        <div className="min-w-0 flex-[999_1_760px] space-y-4">
                            <TooltipProvider delayDuration={200}>{timeline}</TooltipProvider>
                            {/* Legend */}
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-fg-dim">
                                <div className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 rounded-[4px] bg-fg-soft" />
                                    <span>Watching</span>
                                </div>
                                {includePlanToWatch && (
                                    <div className="flex items-center gap-2">
                                        <span className="h-3.5 w-3.5 rounded-[4px] border border-fg-dim" />
                                        <span>Plan to Watch</span>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <span className="h-3.5 w-3.5 rounded-[4px] bg-fg-soft shadow-[2px_-2px_0_-1px_var(--page-bg),3px_-3px_0_-1px_var(--fg-soft)]" />
                                    <span>Several episodes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="relative h-3.5 w-3.5 rounded-[4px] bg-fg-soft">
                                        <span className="absolute -top-1 -left-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-page" />
                                    </span>
                                    <span>Premiere</span>
                                </div>
                                <span>Pick a day to see its episode numbers</span>
                            </div>
                        </div>
                        {panel}
                    </div>
                )}

                {filteredEntries.length === 0 && (
                    <div className="text-center py-16 text-fg-dim">
                        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        {showFilter ? (
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
