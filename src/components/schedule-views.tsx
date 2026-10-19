"use client";

import { useState } from "react";
import type { ScheduleEntry } from "@/actions/schedule";
import type { CalendarPreferences } from "@/actions/preferences";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import { ScheduleFeed, type FeedVariant } from "@/components/schedule-feed";

/**
 * A trial: the month timeline and four day-by-day layouts side by side on the
 * real page, so one can be chosen with real data rather than from a mock-up.
 * The choice is written to `?layout=` so a link reopens the same one. Once a
 * layout is picked, this switcher and the losing layouts go.
 */
export type CalendarLayout = "timeline" | FeedVariant;

export const CALENDAR_LAYOUTS: { id: CalendarLayout; letter: string; label: string }[] = [
    { id: "timeline", letter: "0", label: "Timeline" },
    { id: "cards", letter: "A", label: "Cards" },
    { id: "guide", letter: "B", label: "TV guide" },
    { id: "ready", letter: "C", label: "Ready to watch" },
    { id: "rails", letter: "D", label: "Rails" },
];

export function ScheduleViews({
    entries,
    initialDate,
    initialShow,
    initialLayout,
    initialPrefs,
}: {
    entries: ScheduleEntry[];
    initialDate?: string;
    initialShow?: string;
    initialLayout: CalendarLayout;
    initialPrefs?: CalendarPreferences;
}) {
    const [layout, setLayout] = useState<CalendarLayout>(initialLayout);

    const choose = (next: CalendarLayout) => {
        setLayout(next);
        const url = new URL(window.location.href);
        if (next === "timeline") url.searchParams.delete("layout");
        else url.searchParams.set("layout", next);
        window.history.replaceState({}, "", url);
    };

    return (
        <div>
            <div className="container mx-auto max-w-352 px-4 pt-6">
                <div role="tablist" aria-label="Calendar layout" className="flex gap-0.5 overflow-x-auto border-b border-line-strong [scrollbar-width:none]">
                    {CALENDAR_LAYOUTS.map((l) => (
                        <button
                            key={l.id}
                            role="tab"
                            aria-selected={layout === l.id}
                            onClick={() => choose(l.id)}
                            className={`cursor-pointer -mb-px flex h-10.5 shrink-0 items-baseline gap-2 border-b-2 px-3.5 pt-2.5 text-sm font-medium transition-colors ${layout === l.id ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg"}`}
                        >
                            <b className={`text-xs ${layout === l.id ? "text-primary" : "text-fg-dim"}`}>{l.letter}</b>
                            {l.label}
                        </button>
                    ))}
                </div>
            </div>
            {layout === "timeline" ? (
                <ScheduleCalendar entries={entries} initialDate={initialDate} initialShow={initialShow} initialPrefs={initialPrefs} />
            ) : (
                <ScheduleFeed key={layout} entries={entries} variant={layout} initialShow={initialShow} initialPrefs={initialPrefs} />
            )}
        </div>
    );
}
