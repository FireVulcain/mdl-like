import React from "react";

// Unified editorial header for home-page sections: numbered eyebrow with accent
// identity, big title, hairline. Plain component — usable from server and client.

export type HomeAccent = "violet" | "sky" | "rose" | "orange";

const ACCENTS: Record<
    HomeAccent,
    { text: string; line: string; hairline: string; dot: string }
> = {
    violet: {
        text: "text-violet-400",
        line: "bg-violet-400/60",
        hairline: "bg-linear-to-r from-violet-500/40 via-white/8 to-transparent",
        dot: "bg-violet-400",
    },
    sky: {
        text: "text-sky-400",
        line: "bg-sky-400/60",
        hairline: "bg-linear-to-r from-sky-500/40 via-white/8 to-transparent",
        dot: "bg-sky-400",
    },
    rose: {
        text: "text-rose-400",
        line: "bg-rose-400/60",
        hairline: "bg-linear-to-r from-rose-500/40 via-white/8 to-transparent",
        dot: "bg-rose-400",
    },
    orange: {
        text: "text-orange-400",
        line: "bg-orange-400/60",
        hairline: "bg-linear-to-r from-orange-500/40 via-white/8 to-transparent",
        dot: "bg-orange-400",
    },
};

export function HomeSectionHeader({
    index,
    eyebrow,
    title,
    subtitle,
    accent,
    live = false,
    right,
}: {
    index: string;
    eyebrow: string;
    title: string;
    subtitle?: string;
    accent: HomeAccent;
    live?: boolean;
    right?: React.ReactNode;
}) {
    const a = ACCENTS[accent];
    return (
        <div className="space-y-4 md:space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div className="space-y-1.5 md:space-y-2 min-w-0">
                    <div className="flex items-center gap-2.5">
                        <span className={`text-[11px] font-bold tracking-[0.25em] tabular-nums ${a.text}`}>{index}</span>
                        <span className={`h-px w-6 md:w-8 ${a.line}`} />
                        <span className={`text-[11px] font-semibold tracking-[0.25em] uppercase ${a.text}`}>{eyebrow}</span>
                        {live && (
                            <span className="flex items-center gap-1.5 ml-1">
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${a.dot}`} />
                                <span className={`text-[10px] font-semibold tracking-widest ${a.text}`}>LIVE</span>
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                    {subtitle && <p className="text-xs md:text-sm text-gray-500">{subtitle}</p>}
                </div>
                {right}
            </div>
            <div className={`h-px w-full ${a.hairline}`} />
        </div>
    );
}

// Sub-row label used inside sections ("Popular Right Now", "Airing Now", …).
// Takes a raw dot class since rows use their own accent colors.
export function HomeRowLabel({ dotClass, label }: { dotClass: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            <h3 className="text-xs md:text-sm font-semibold tracking-[0.18em] uppercase text-gray-300">{label}</h3>
        </div>
    );
}
