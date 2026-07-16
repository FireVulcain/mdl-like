"use client";

import { useState } from "react";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";
import { toast } from "sonner";

// Mirrors the quick filters available on the calendar page itself — both write
// the same UserPreferences row, so they stay in sync. Saves on click.
export function CalendarSettings({ initialPrefs }: { initialPrefs: CalendarPreferences }) {
    const [asianOnly, setAsianOnly] = useState(initialPrefs.calendarAsianOnly);
    const [includePlanToWatch, setIncludePlanToWatch] = useState(initialPrefs.calendarIncludePlanToWatch);

    const save = async (prefs: Partial<CalendarPreferences>) => {
        await saveCalendarPreferences(prefs);
        toast.success("Calendar preferences saved");
    };

    return (
        <div className="divide-y divide-white/8">
            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Region</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setAsianOnly(false); save({ calendarAsianOnly: false }); }}
                        className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            !asianOnly ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        All shows
                    </button>
                    <button
                        onClick={() => { setAsianOnly(true); save({ calendarAsianOnly: true }); }}
                        className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            asianOnly ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        Asian shows only
                    </button>
                </div>
            </div>

            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Statuses</h3>
                <button
                    onClick={() => {
                        const next = !includePlanToWatch;
                        setIncludePlanToWatch(next);
                        save({ calendarIncludePlanToWatch: next });
                    }}
                    className="cursor-pointer flex items-center gap-3 group"
                >
                    <span
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                            includePlanToWatch ? "bg-blue-500" : "bg-white/10"
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                                includePlanToWatch ? "left-5.5" : "left-0.5"
                            }`}
                        />
                    </span>
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                        Include &ldquo;Plan to Watch&rdquo; shows
                    </span>
                </button>
                <p className="text-xs text-gray-600">
                    When off, the calendar only shows episodes from shows you are currently watching.
                </p>
            </div>
        </div>
    );
}
