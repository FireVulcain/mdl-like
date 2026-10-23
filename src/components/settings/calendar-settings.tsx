"use client";

import { useState } from "react";
import { saveCalendarPreferences, type CalendarPreferences } from "@/actions/preferences";
import { SegmentedRail, SettingRow, Switch } from "@/components/settings/settings-ui";
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
        <>
            <SettingRow label="Calendar region" hint="Also adjustable from the calendar page itself.">
                <SegmentedRail
                    label="Calendar region"
                    value={asianOnly ? "asian" : "all"}
                    options={[
                        { value: "all", label: "All shows" },
                        { value: "asian", label: "Asian shows only" },
                    ]}
                    onChange={(next) => {
                        const asian = next === "asian";
                        setAsianOnly(asian);
                        save({ calendarAsianOnly: asian });
                    }}
                />
            </SettingRow>
            <SettingRow
                label="Plan to Watch in the calendar"
                hint="When off, the calendar only shows episodes from shows you are currently watching."
            >
                <Switch
                    label="Include Plan to Watch shows in the calendar"
                    checked={includePlanToWatch}
                    onChange={(next) => {
                        setIncludePlanToWatch(next);
                        save({ calendarIncludePlanToWatch: next });
                    }}
                />
            </SettingRow>
        </>
    );
}
