"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MIN = 0;
const MAX = 10;
const STEP = 0.1;

/**
 * Min/max rating filter, as a two-handle slider.
 *
 * Built from two overlaid native range inputs rather than a slider library: it
 * is one filter on one page, and the native inputs come with keyboard control
 * and screen-reader semantics for free.
 *
 * Navigation happens on release, never while dragging. Each committed value is a
 * new URL, which is a fresh scrape — a push per pixel would hammer the scraper
 * and make the page unusable.
 */
export function RatingRangeFilter({
    buildUrl,
    initialMin,
    initialMax,
}: {
    /** Serialised URL template with __MIN__ / __MAX__ placeholders (server-built) */
    buildUrl: string;
    initialMin?: string;
    initialMax?: string;
}) {
    const router = useRouter();
    // The URL is the source of truth — Clear filters and the back button both
    // change it behind this component's back. It is keyed on the two values by
    // its parent, so a change remounts it and these initialisers run again;
    // resetting from an effect instead would re-render twice for every reset.
    const [min, setMin] = useState(() => (initialMin ? parseFloat(initialMin) : MIN));
    const [max, setMax] = useState(() => (initialMax ? parseFloat(initialMax) : MAX));

    const committed = useRef<string | null>(null);

    const commit = (lo: number, hi: number) => {
        // At the extremes the filter is not applied at all, so the parameter is
        // dropped rather than pinned at 0 or 10 — otherwise "Clear filters" and
        // a full-width slider would disagree about whether a filter is on.
        const filled = buildUrl
            .replace("__MIN__", lo > MIN ? lo.toFixed(1) : "")
            .replace("__MAX__", hi < MAX ? hi.toFixed(1) : "");

        // Emptying a placeholder leaves "rating_min=" behind, which would count
        // as an active filter everywhere else on the page.
        const parsed = new URL(filled, "http://local");
        for (const [k, v] of [...parsed.searchParams.entries()]) {
            if (v === "") parsed.searchParams.delete(k);
        }
        const url = `${parsed.pathname}?${parsed.searchParams.toString()}`;

        if (committed.current === url) return;
        committed.current = url;
        router.push(url, { scroll: false });
    };

    const onMinChange = (v: number) => setMin(Math.min(v, max - STEP < MIN ? MIN : Math.min(v, max)));
    const onMaxChange = (v: number) => setMax(Math.max(v, min));

    const pct = (v: number) => ((v - MIN) / (MAX - MIN)) * 100;
    const isDefault = min === MIN && max === MAX;

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Rating</h4>
                <span className={`text-xs tabular-nums ${isDefault ? "text-fg-faint" : "text-fg"}`}>
                    {isDefault ? "Any" : `${min.toFixed(1)} – ${max.toFixed(1)}`}
                </span>
            </div>

            {/* Two inputs stacked on one track. Each is transparent and only its
                thumb takes pointer events, so whichever handle is under the
                cursor is the one that moves. */}
            <div className="relative h-5">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-4" />
                <div
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-sky-400"
                    style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }}
                />
                <input
                    type="range"
                    aria-label="Minimum rating"
                    min={MIN}
                    max={MAX}
                    step={STEP}
                    value={min}
                    onChange={(e) => onMinChange(parseFloat(e.target.value))}
                    onPointerUp={() => commit(min, max)}
                    onKeyUp={() => commit(min, max)}
                    className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
                />
                <input
                    type="range"
                    aria-label="Maximum rating"
                    min={MIN}
                    max={MAX}
                    step={STEP}
                    value={max}
                    onChange={(e) => onMaxChange(parseFloat(e.target.value))}
                    onPointerUp={() => commit(min, max)}
                    onKeyUp={() => commit(min, max)}
                    className="range-thumb absolute inset-0 w-full appearance-none bg-transparent"
                />
            </div>

            <div className="flex justify-between text-xs text-fg-faint tabular-nums">
                <span>{MIN}</span>
                <span>{MAX}</span>
            </div>
        </div>
    );
}
