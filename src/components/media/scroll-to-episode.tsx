"use client";

import { ArrowDownToLine } from "lucide-react";

// Smooth-scrolls to an episode card (which carries id="ep-N" and scroll-mt-28).
// Used to jump to the first unwatched episode from the season header.
export function ScrollToEpisodeButton({ episodeNumber, label }: { episodeNumber: number; label: string }) {
    const handleClick = () => {
        const el = document.getElementById(`ep-${episodeNumber}`);
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "start" });

        const flash = () => {
            el.classList.remove("episode-flash");
            void el.offsetWidth; // force reflow so the animation restarts
            el.classList.add("episode-flash");
            el.addEventListener("animationend", () => el.classList.remove("episode-flash"), { once: true });
        };

        // Play the flash once the smooth scroll settles. `scrollend` is the precise
        // signal; a timeout backs it up when it doesn't fire (no scroll needed, or
        // unsupported), and whichever wins cancels the other.
        let done = false;
        const run = () => {
            if (done) return;
            done = true;
            window.removeEventListener("scrollend", run);
            clearTimeout(fallback);
            flash();
        };
        const fallback = setTimeout(run, 700);
        window.addEventListener("scrollend", run, { once: true });
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
