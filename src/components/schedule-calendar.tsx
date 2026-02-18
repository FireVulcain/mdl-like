"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ScheduleEntry } from "@/actions/schedule";

export type { ScheduleEntry };

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function toDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function ScheduleCalendar({ entries, initialDate }: { entries: ScheduleEntry[]; initialDate?: string }) {
    const today = new Date();

    // Parse "YYYY-MM-DD" param — derive initial month and highlighted date
    const parseInitial = () => {
        if (initialDate && /^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
            const [y, m] = initialDate.split("-").map(Number);
            if (!isNaN(y) && m >= 1 && m <= 12) return { y, m: m - 1 };
        }
        return { y: today.getFullYear(), m: today.getMonth() };
    };
    const initial = parseInitial();

    const [year, setYear] = useState(initial.y);
    const [month, setMonth] = useState(initial.m);

    const goToPrev = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const goToNext = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };
    const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

    // Map airDate -> (mediaId -> episodes[]) — one icon per show per day
    const byDate = new Map<string, Map<string, ScheduleEntry[]>>();
    for (const entry of entries) {
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

    const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
    const thisMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const episodesThisMonth = entries.filter((e) => e.airDate.startsWith(thisMonthPrefix)).length;

    return (
        <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-black">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">

                {/* Page header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                            <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Schedule</h1>
                            <p className="text-sm text-gray-400">
                                {episodesThisMonth > 0
                                    ? `${episodesThisMonth} episode${episodesThisMonth !== 1 ? "s" : ""} airing in ${MONTH_NAMES[month]}`
                                    : `Nothing airing in ${MONTH_NAMES[month]}`}
                            </p>
                        </div>
                    </div>

                    {/* Month navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={goToToday}
                            className="cursor-pointer px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors"
                        >
                            Today
                        </button>
                        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                            <button onClick={goToPrev} className="cursor-pointer p-2.5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="px-4 text-sm font-semibold text-white w-40 text-center">
                                {MONTH_NAMES[month]} {year}
                            </span>
                            <button onClick={goToNext} className="cursor-pointer p-2.5 hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Calendar */}
                <div className="rounded-2xl border border-white/10 overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 bg-white/4 border-b border-white/10">
                        {DAY_HEADERS.map((day, i) => (
                            <div
                                key={day}
                                className={`py-3 text-center text-xs font-semibold tracking-wider ${
                                    i >= 5 ? "text-gray-500" : "text-gray-400"
                                }`}
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
                                            !isLastRow ? "border-b border-white/5" : "",
                                            !isLastCol ? "border-r border-white/5" : "",
                                            !cell.current ? "opacity-20" : "",
                                            cell.current && isPast && !isToday ? "opacity-50" : "",
                                            cell.current && isWeekend && !isHighlighted ? "bg-white/1.5" : "",
                                            cell.current && isToday && !isHighlighted ? "bg-primary/5" : "",
                                            cell.current && isHighlighted ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/30" : "",
                                        ].filter(Boolean).join(" ")}
                                    >
                                        {/* Day number */}
                                        <div className="flex justify-end">
                                            <span
                                                className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${
                                                    isToday
                                                        ? "bg-primary text-white"
                                                        : cell.current
                                                        ? "text-gray-300"
                                                        : "text-gray-600"
                                                }`}
                                            >
                                                {cell.day}
                                            </span>
                                        </div>

                                        {/* Episode icons — one per show */}
                                        {dayGroups.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {dayGroups.slice(0, 4).map((showEps, gi) => {
                                                    const first = showEps[0];
                                                    return (
                                                        <Tooltip key={gi}>
                                                            <TooltipTrigger asChild>
                                                                <Link href={`/media/${first.mediaId}`}>
                                                                    <div className="relative w-8 h-8 rounded-full overflow-hidden ring-2 ring-gray-800 hover:ring-primary/70 hover:scale-110 transition-all bg-gray-800 shrink-0">
                                                                        {first.poster ? (
                                                                            <Image
                                                                                src={first.poster}
                                                                                alt={first.title}
                                                                                fill
                                                                                sizes="32px"
                                                                                className="object-cover object-top"
                                                                            />
                                                                        ) : (
                                                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                                                                                {first.title.slice(0, 2).toUpperCase()}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top">
                                                                <p className="font-semibold mb-1">{first.title}</p>
                                                                {showEps.map((ep, ei) => (
                                                                    <p key={ei} className="text-gray-400 text-xs">
                                                                        S{String(ep.seasonNumber).padStart(2, "0")}E{String(ep.episodeNumber).padStart(2, "0")}
                                                                        {ep.episodeName ? ` · ${ep.episodeName}` : ""}
                                                                    </p>
                                                                ))}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    );
                                                })}
                                                {dayGroups.length > 4 && (
                                                    <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-300 shrink-0">
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
                <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-[10px]">7</span>
                        <span>Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-amber-500/10 ring-1 ring-inset ring-amber-500/30" />
                        <span>Linked date</span>
                    </div>
                </div>

                {entries.length === 0 && (
                    <div className="text-center py-16 text-gray-500">
                        <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No upcoming episodes</p>
                        <p className="text-sm mt-1">Add shows to your watchlist to see their schedule here</p>
                    </div>
                )}
            </div>
        </div>
    );
}
