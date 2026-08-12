"use client";

import { ArrowDownToLine } from "lucide-react";

// Smooth-scrolls to an episode card (which carries id="ep-N" and scroll-mt-28).
// Used to jump to the first unwatched episode from the season header.
export function ScrollToEpisodeButton({ episodeNumber, label }: { episodeNumber: number; label: string }) {
    const handleClick = () => {
        const el = document.getElementById(`ep-${episodeNumber}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });

        // Started now, not on `scrollend`. The mark and the travel are one gesture:
        // the card is already tinted when it comes into view, rather than arriving
        // and then having something happen to it. Its hold phase outlasts a smooth
        // scroll, so the mark is still there however far the jump was.
        el.classList.remove("episode-highlight");
        void el.offsetWidth; // force reflow so a second click replays it
        el.classList.add("episode-highlight");
        el.addEventListener("animationend", () => el.classList.remove("episode-highlight"), { once: true });
    };
    return (
        <button
            onClick={handleClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
        >
            <ArrowDownToLine className="size-3.5" />
            {label}
        </button>
    );
}
