"use client";

import { ArrowDownToLine } from "lucide-react";

// Smooth-scrolls to an episode card (which carries id="ep-N" and scroll-mt-28).
// Used to jump to the first unwatched episode from the season header.
export function ScrollToEpisodeButton({ episodeNumber, label }: { episodeNumber: number; label: string }) {
    return (
        <button
            onClick={() => document.getElementById(`ep-${episodeNumber}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
        >
            <ArrowDownToLine className="size-3.5" />
            {label}
        </button>
    );
}
