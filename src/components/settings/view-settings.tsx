"use client";

import { useState } from "react";
import { saveViewPreferences, type ViewPreferences } from "@/actions/preferences";
import { ChevronDown } from "lucide-react";
import { SegmentedRail, SettingRow } from "@/components/settings/settings-ui";
import { toast } from "sonner";

const WATCHLIST_SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "default", label: "Default (status order)" },
    { value: "rating-high", label: "My rating — high first" },
    { value: "rating-low", label: "My rating — low first" },
    { value: "mdl-rating-high", label: "MDL rating — high first" },
    { value: "mdl-rating-low", label: "MDL rating — low first" },
    { value: "progress-high", label: "Progress — high first" },
    { value: "progress-low", label: "Progress — low first" },
    { value: "title-az", label: "Title — A to Z" },
    { value: "title-za", label: "Title — Z to A" },
    { value: "year-new", label: "Year — newest first" },
    { value: "year-old", label: "Year — oldest first" },
    { value: "next-episode-asc", label: "Next episode — soonest first" },
    { value: "next-episode-desc", label: "Next episode — latest first" },
];

// Saves on change, like the calendar settings. The watchlist page can still
// override per session via its own sort picker / URL params.
const ADD_STATUS_OPTIONS = ["Watching", "Completed", "Plan to Watch", "Dropped"];

export function WatchlistViewSettings({ initialPrefs }: { initialPrefs: ViewPreferences }) {
    const [thumbnailStyle, setThumbnailStyle] = useState(initialPrefs.watchlistThumbnailStyle);
    const [defaultSort, setDefaultSort] = useState(initialPrefs.watchlistDefaultSort);
    const [addStatus, setAddStatus] = useState(initialPrefs.defaultAddStatus);

    const save = async (prefs: Partial<ViewPreferences>) => {
        await saveViewPreferences(prefs);
        toast.success("Watchlist preferences saved");
    };

    return (
        <>
            <SettingRow label="Watchlist thumbnails">
                <SegmentedRail
                    label="Watchlist thumbnails"
                    value={thumbnailStyle}
                    options={[
                        { value: "poster", label: "Posters" },
                        { value: "backdrop", label: "Backdrops" },
                    ]}
                    onChange={(next) => {
                        setThumbnailStyle(next);
                        save({ watchlistThumbnailStyle: next });
                    }}
                />
            </SettingRow>
            <SettingRow label="Watchlist order" hint="Applied when opening the watchlist; the sort picker there still works per visit.">
                <label className="relative block w-full sm:w-60">
                    <select
                        value={defaultSort}
                        onChange={(e) => {
                            setDefaultSort(e.target.value);
                            save({ watchlistDefaultSort: e.target.value });
                        }}
                        aria-label="Watchlist order"
                        className="h-8 w-full cursor-pointer appearance-none rounded-md bg-surface-2 pl-2.5 pr-8 text-[13px] text-fg-soft outline-none focus:ring-1 focus:ring-line-strong [&>option]:bg-panel"
                    >
                        {WATCHLIST_SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-dim" />
                </label>
            </SettingRow>
            <SettingRow label="Status when adding a title" hint="Preselected status in the “Add to Watchlist” dialog.">
                <SegmentedRail
                    label="Status when adding a title"
                    value={addStatus}
                    options={ADD_STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
                    onChange={(next) => {
                        setAddStatus(next);
                        save({ defaultAddStatus: next });
                    }}
                />
            </SettingRow>
        </>
    );
}
