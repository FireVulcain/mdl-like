import React from "react";

// Unified editorial header for home-page sections: plain-case eyebrow label,
// big title, a short accent rule. Usable from server and client.

export type HomeAccent = "violet" | "sky" | "rose" | "orange" | "fuchsia" | "emerald" | "teal" | "indigo" | "lime" | "cyan";

const ACCENTS: Record<HomeAccent, { text: string; dot: string }> = {
    violet: { text: "text-violet-400", dot: "bg-violet-400" },
    sky: { text: "text-sky-400", dot: "bg-sky-400" },
    rose: { text: "text-rose-400", dot: "bg-rose-400" },
    orange: { text: "text-orange-400", dot: "bg-orange-400" },
    fuchsia: { text: "text-fuchsia-400", dot: "bg-fuchsia-400" },
    emerald: { text: "text-emerald-400", dot: "bg-emerald-400" },
    teal: { text: "text-teal-400", dot: "bg-teal-400" },
    indigo: { text: "text-indigo-400", dot: "bg-indigo-400" },
    lime: { text: "text-lime-400", dot: "bg-lime-400" },
    cyan: { text: "text-cyan-400", dot: "bg-cyan-400" },
};

export function HomeSectionHeader({
    eyebrow,
    title,
    subtitle,
    accent,
    live = false,
    right,
}: {
    eyebrow: string;
    title: string;
    subtitle?: string;
    accent: HomeAccent;
    live?: boolean;
    right?: React.ReactNode;
}) {
    const a = ACCENTS[accent];
    return (
        <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="space-y-1.5 md:space-y-2 min-w-0">
                <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-semibold tracking-wide ${a.text}`}>{eyebrow}</span>
                    {live && (
                        <span className="flex items-center gap-1.5 ml-1">
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${a.dot}`} />
                            <span className={`text-[10px] font-semibold tracking-widest ${a.text}`}>LIVE</span>
                        </span>
                    )}
                </div>
                <h2 className="text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                {subtitle && <p className="text-xs md:text-sm text-gray-500">{subtitle}</p>}
                <span className={`block h-0.5 w-11 rounded-full mt-2.5 ${a.dot}`} />
            </div>
            {right}
        </div>
    );
}

// Sub-row label used inside sections ("Popular Right Now", "Airing Now", …).
// Takes a raw dot class since rows use their own accent colors.
export function HomeRowLabel({ dotClass, label }: { dotClass: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            <h3 className="text-base font-bold text-gray-200">{label}</h3>
        </div>
    );
}
