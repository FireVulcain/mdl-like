"use client";

export type MediaSource = "mdl" | "tmdb";

/**
 * The MDL / TMDB switch that sits beside a section heading.
 *
 * This markup existed in four copies — cast, episodes, episode ratings and recs
 * — and had already drifted: three carried a solid white active chip inside a
 * bordered track, the fourth a blue-tinted chip in a track with no border. One
 * component now, so the fifth cannot disagree with the other four.
 *
 * The frame stays, unlike everywhere else on these pages: a segmented control
 * has to show which of two options is on, and that is the one job a box around a
 * control actually does.
 */
export function SourceToggle({
    value,
    onChange,
    className = "",
}: {
    value: MediaSource;
    onChange: (next: MediaSource) => void;
    className?: string;
}) {
    return (
        <div className={`inline-flex rounded-lg border border-line-strong bg-surface-2 p-0.5 gap-0.5 ${className}`}>
            {(["mdl", "tmdb"] as const).map((s) => (
                <button
                    key={s}
                    onClick={() => onChange(s)}
                    className={`cursor-pointer px-3 py-1 text-xs rounded font-medium transition-colors ${
                        value === s ? "bg-white text-gray-900" : "text-fg-muted hover:text-fg"
                    }`}
                >
                    {s === "mdl" ? "MDL" : "TMDB"}
                </button>
            ))}
        </div>
    );
}
