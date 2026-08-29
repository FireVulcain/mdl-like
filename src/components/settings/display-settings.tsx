"use client";

import { useState } from "react";
import { saveDisplayPreferences, type DisplayPreferences } from "@/actions/preferences";
import { SettingToggle } from "@/components/settings/setting-toggle";
import { toast } from "sonner";

export function DisplaySettings({ initialPrefs }: { initialPrefs: DisplayPreferences }) {
    const [titleLanguage, setTitleLanguage] = useState(initialPrefs.titleLanguage);
    const [hideSpoilers, setHideSpoilers] = useState(initialPrefs.hideSpoilers);

    const save = async (prefs: Partial<DisplayPreferences>) => {
        await saveDisplayPreferences(prefs);
        toast.success("Display preferences saved");
    };

    return (
        <div className="divide-y divide-line">
            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Title language</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            setTitleLanguage("english");
                            save({ titleLanguage: "english" });
                        }}
                        className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            titleLanguage === "english"
                                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                : "bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg"
                        }`}
                    >
                        English titles
                    </button>
                    <button
                        onClick={() => {
                            setTitleLanguage("native");
                            save({ titleLanguage: "native" });
                        }}
                        className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            titleLanguage === "native"
                                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                : "bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg"
                        }`}
                    >
                        Native titles
                    </button>
                </div>
                <p className="text-xs text-fg-faint">
                    Applied wherever the original title is known: home sections, media pages, watchlist, browse and
                    calendar. Native titles fill in progressively as they are fetched from MDL.
                </p>
            </div>

            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Spoilers</h3>
                <SettingToggle
                    checked={hideSpoilers}
                    onChange={(next) => {
                        setHideSpoilers(next);
                        save({ hideSpoilers: next });
                    }}
                    label="Hide spoilers for shows in my watchlist"
                    hint="Masks episode names, synopsis and stills beyond your current progress (episode guide, calendar, countdown)."
                />
            </div>
        </div>
    );
}
