import React from "react";

// Unified header for home-page sections: title, a short accent rule, and an
// optional slot on the right. Usable from server and client.
//
// It used to open with a small coloured label above the title — "South Korea"
// over "K-Drama Universe", "Worldwide" over "Trending Worldwide", "For You" over
// "From Actors You Watch". In every case the label was contained in the title's
// own meaning, and a floating tag above every heading is one of the things that
// makes a page read as generated. The subtitle went the same way: eight sections
// carried the same sentence with the city swapped, and none of them said
// anything the title had not.

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
    title,
    accent,
    right,
}: {
    title: string;
    accent: HomeAccent;
    right?: React.ReactNode;
}) {
    const a = ACCENTS[accent];
    return (
        <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="min-w-0">
                {/* Semibold rather than black: a serif this size carries a heading
                    on its contrast, and the heaviest weights close its counters. */}
                <h2 className="font-display text-2xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
                <span className={`block h-0.5 w-11 rounded-full mt-2.5 ${a.dot}`} />
            </div>
            {right}
        </div>
    );
}

// Sub-row label used inside sections ("Popular Right Now", "Airing Now", …).
// Takes a raw dot class since rows use their own accent colors.
//
// Display face, like the section title above it: the rule across the page is
// that headings naming a part of it are set in the serif, while everything that
// is data — show titles, dates, ratings — stays in the sans. Leaving this one
// level in the sans put a seam in the middle of the hierarchy.
export function HomeRowLabel({ dotClass, label }: { dotClass: string; label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
            <h3 className="font-display text-base font-bold text-gray-200">{label}</h3>
        </div>
    );
}
