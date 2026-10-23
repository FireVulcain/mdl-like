"use client";

import { useState } from "react";
import { saveDisplayPreferences, type DisplayPreferences } from "@/actions/preferences";
import { SegmentedRail, SettingRow, Switch } from "@/components/settings/settings-ui";
import { toast } from "sonner";

export function DisplaySettings({ initialPrefs }: { initialPrefs: DisplayPreferences }) {
    const [titleLanguage, setTitleLanguage] = useState(initialPrefs.titleLanguage);
    const [hideSpoilers, setHideSpoilers] = useState(initialPrefs.hideSpoilers);

    const save = async (prefs: Partial<DisplayPreferences>) => {
        await saveDisplayPreferences(prefs);
        toast.success("Display preferences saved");
    };

    return (
        <>
            <SettingRow
                label="Title language"
                hint="Applied wherever the original title is known: home sections, media pages, watchlist, browse and calendar. Native titles fill in progressively as they are fetched from MDL."
            >
                <SegmentedRail
                    label="Title language"
                    value={titleLanguage}
                    options={[
                        { value: "english", label: "English titles" },
                        { value: "native", label: "Native titles" },
                    ]}
                    onChange={(next) => {
                        setTitleLanguage(next);
                        save({ titleLanguage: next });
                    }}
                />
            </SettingRow>
            <SettingRow
                label="Hide spoilers for shows in my watchlist"
                hint="Masks episode names, synopsis and stills beyond your current progress (episode guide, calendar, countdown)."
            >
                <Switch
                    label="Hide spoilers for shows in my watchlist"
                    checked={hideSpoilers}
                    onChange={(next) => {
                        setHideSpoilers(next);
                        save({ hideSpoilers: next });
                    }}
                />
            </SettingRow>
        </>
    );
}
