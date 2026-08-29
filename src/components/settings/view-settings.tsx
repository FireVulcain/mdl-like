"use client";

import { useState } from "react";
import { saveViewPreferences, type ViewPreferences } from "@/actions/preferences";
import { GalleryHorizontal, GalleryVertical } from "lucide-react";
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
        <div className="divide-y divide-line">
            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Thumbnails</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setThumbnailStyle("poster"); save({ watchlistThumbnailStyle: "poster" }); }}
                        className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            thumbnailStyle === "poster"
                                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                : "bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg"
                        }`}
                    >
                        <GalleryHorizontal className="h-4 w-4" />
                        Posters
                    </button>
                    <button
                        onClick={() => { setThumbnailStyle("backdrop"); save({ watchlistThumbnailStyle: "backdrop" }); }}
                        className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            thumbnailStyle === "backdrop"
                                ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                : "bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg"
                        }`}
                    >
                        <GalleryVertical className="h-4 w-4" />
                        Backdrops
                    </button>
                </div>
            </div>

            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Default sort</h3>
                <select
                    value={defaultSort}
                    onChange={(e) => { setDefaultSort(e.target.value); save({ watchlistDefaultSort: e.target.value }); }}
                    className="cursor-pointer w-full max-w-sm px-3 py-2 rounded-lg bg-surface-2 border border-line-strong text-sm text-fg-soft focus:outline-none focus:border-line-strong [&>option]:bg-panel"
                >
                    {WATCHLIST_SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <p className="text-xs text-fg-faint">Applied when opening the watchlist — the sort picker there still works per visit.</p>
            </div>

            <div className="space-y-2.5 py-5 first:pt-0 last:pb-0">
                <h3 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Default status when adding</h3>
                <div className="flex flex-wrap gap-2">
                    {ADD_STATUS_OPTIONS.map((status) => (
                        <button
                            key={status}
                            onClick={() => { setAddStatus(status); save({ defaultAddStatus: status }); }}
                            className={`cursor-pointer px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                addStatus === status
                                    ? "bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30"
                                    : "bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg"
                            }`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-fg-faint">Preselected status in the &ldquo;Add to Watchlist&rdquo; dialog.</p>
            </div>
        </div>
    );
}

