"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { KuryanaDramaListItem, KuryanaDramaListSection } from "@/lib/kuryana";

export type ListSection = { key: string; label: string; section: KuryanaDramaListSection };

const ALL = "__all__";

// Labels are normalised upstream, so one spelling per status reaches here.
const STATUS_DOT: Record<string, string> = {
    Watching: "bg-blue-400",
    Completed: "bg-emerald-400",
    "On-hold": "bg-amber-400",
    "Plan to Watch": "bg-slate-400",
    Dropped: "bg-rose-400",
    Undecided: "bg-violet-400",
};

type Entry = KuryanaDramaListItem & { status: string };

/** Titles held in a section — the stats count them even when the rows are withheld. */
function titleCount(section: KuryanaDramaListSection): number {
    const n = (key: string) => parseInt(section.stats[key] ?? "0", 10) || 0;
    const counted = n("Dramas") + n("TV Shows") + n("Movies");
    return counted > 0 ? counted : section.items.length;
}

function statTotal(sections: ListSection[], key: string): number {
    return sections.reduce((sum, s) => sum + (parseFloat(s.section.stats[key] ?? "0") || 0), 0);
}

const PAGE_SIZE = 100;

/**
 * The score column is the spine of the page, so it carries the emphasis: the
 * ones someone rated highest read brightest, and an unrated entry recedes to a
 * rule rather than a zero.
 */
function scoreTone(value: number): string {
    if (value >= 9) return "text-sky-300";
    if (value >= 8) return "text-sky-400/90";
    if (value >= 6) return "text-gray-300";
    return "text-gray-500";
}

// `first` is passed rather than relying on a `first:` variant: each heading is
// the first child of its own wrapper, so the variant would match every time and
// collapse the space above every group.
function GroupHeading({ label, count, first }: { label: string; count: number; first: boolean }) {
    return (
        <div className={`flex items-center gap-2.5 pb-2.5 ${first ? "" : "pt-10"}`}>
            <span className={`size-1.5 rounded-full ${STATUS_DOT[label] ?? "bg-white/20"}`} />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">{label}</h2>
            <span className="font-mono text-[11px] tabular-nums text-gray-600">{count}</span>
            <span className="flex-1 h-px bg-white/6" />
        </div>
    );
}

function Row({ entry }: { entry: Entry }) {
    const score = parseFloat(entry.score);
    // "0.0" is MDL for "not rated", not a rating of zero.
    const rated = Number.isFinite(score) && score > 0;

    const seen = parseInt(entry.episode_seen, 10) || 0;
    const total = parseInt(entry.episode_total, 10) || 0;
    const partial = total > 0 && seen > 0 && seen < total;

    return (
        <Link
            href={`/media/mdl-${entry.id}`}
            className="group grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 sm:gap-x-5 py-2.5 border-b border-white/6 hover:border-white/15 transition-colors"
        >
            <span className="min-w-0 truncate text-sm text-gray-300 group-hover:text-white transition-colors">
                {entry.name}
            </span>

            {/* Episodes: what was seen stays lit, the rest of the run recedes —
                so a half-watched show reads as unfinished without a bar. */}
            <span className="font-mono text-xs tabular-nums text-right w-16 sm:w-20 shrink-0">
                {total > 0 ? (
                    <>
                        <span className={partial ? "text-white" : "text-gray-600"}>{seen}</span>
                        <span className="text-gray-700">/{total}</span>
                    </>
                ) : (
                    <span className="text-gray-700">—</span>
                )}
            </span>

            <span className={`font-mono text-sm tabular-nums text-right w-9 shrink-0 ${rated ? scoreTone(score) : "text-gray-700"}`}>
                {rated ? score.toFixed(1) : "·"}
            </span>
        </Link>
    );
}

export function MdlUserList({ sections }: { sections: ListSection[] }) {
    const [active, setActive] = useState<string>(ALL);
    const [query, setQuery] = useState("");
    const [shown, setShown] = useState(PAGE_SIZE);

    // The whole archive by default. Sections come in their own order — what
    // someone is watching now belongs above what they finished years ago — and
    // the titles inside each one keep the order MDL sent them in, which is
    // alphabetical. Re-sorting by score here would mean the page disagreed with
    // the list it is showing.
    const allEntries = useMemo<Entry[]>(
        () => sections.flatMap((s) => s.section.items.map((item) => ({ ...item, status: s.label }))),
        [sections],
    );

    const scoped = useMemo<Entry[]>(
        () => (active === ALL ? allEntries : allEntries.filter((e) => e.status === active)),
        [allEntries, active],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? scoped.filter((e) => e.name.toLowerCase().includes(q)) : scoped;
    }, [scoped, query]);

    const select = (key: string) => {
        setActive(key);
        setQuery("");
        setShown(PAGE_SIZE);
    };

    // Totals when nothing is filtered, that section's own numbers otherwise.
    const scopedSections = active === ALL ? sections : sections.filter((s) => s.label === active);
    const titles = scopedSections.reduce((sum, s) => sum + titleCount(s.section), 0);
    const episodes = statTotal(scopedSections, "Episodes");
    const days = statTotal(scopedSections, "Days");

    // Every section MDL counted but declined to list — worth saying once, at the
    // bottom, rather than pretending the archive is shorter than it is.
    const withheld = scopedSections
        .filter((s) => s.section.items.length === 0 && titleCount(s.section) > 0)
        .map((s) => `${titleCount(s.section)} ${s.label.toLowerCase()}`);

    const visible = filtered.slice(0, shown);
    const n = (value: number) => value.toLocaleString("en-US");

    return (
        <div className="space-y-8">
            {/* The numbers, set as a statement rather than as chips */}
            <div className="flex flex-wrap items-end gap-x-10 sm:gap-x-14 gap-y-4">
                {[
                    { value: n(titles), label: "titles" },
                    { value: n(Math.round(episodes)), label: "episodes" },
                    { value: days.toFixed(1), label: "days of their life" },
                ].map((stat) => (
                    <div key={stat.label}>
                        <p className="font-display text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none">
                            {stat.value}
                        </p>
                        <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">{stat.label}</p>
                    </div>
                ))}
            </div>

            <div className="h-px bg-linear-to-r from-sky-500/40 via-white/8 to-transparent" />

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {[{ key: ALL, label: "All" }, ...sections.map((s) => ({ key: s.label, label: s.label }))].map((tab) => {
                        const isActive = tab.key === active;
                        const count =
                            tab.key === ALL
                                ? sections.reduce((sum, s) => sum + titleCount(s.section), 0)
                                : titleCount(sections.find((s) => s.label === tab.key)!.section);
                        return (
                            <button
                                key={tab.key}
                                onClick={() => select(tab.key)}
                                className={`cursor-pointer group flex items-baseline gap-1.5 text-sm transition-colors ${
                                    isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
                                }`}
                            >
                                <span className={isActive ? "border-b border-sky-400 pb-0.5" : "border-b border-transparent pb-0.5"}>
                                    {tab.label}
                                </span>
                                <span className="font-mono text-[11px] tabular-nums text-gray-600">{count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="relative w-full sm:w-56">
                    <Search className="absolute left-0 top-1/2 -translate-y-1/2 size-3.5 text-gray-600" />
                    <input
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShown(PAGE_SIZE);
                        }}
                        placeholder="Filter titles…"
                        className="w-full pl-6 pr-2 py-1.5 bg-transparent border-b border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-sky-400/60 transition-colors"
                    />
                </div>
            </div>

            {/* The archive. Unfiltered, it stays grouped by status — a heading
                each time the run changes, rather than a badge on every row. */}
            {visible.length > 0 ? (
                <div>
                    {visible.map((entry, i) => {
                        const startsGroup = active === ALL && entry.status !== visible[i - 1]?.status;
                        return (
                            <div key={`${entry.status}-${entry.id}-${entry.name}`}>
                                {startsGroup && (
                                    <GroupHeading
                                        label={entry.status}
                                        count={scoped.filter((e) => e.status === entry.status).length}
                                        first={i === 0}
                                    />
                                )}
                                <Row entry={entry} />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="py-12 text-center text-sm text-gray-600">
                    {query.trim() ? "No title matches." : "Nothing listed here."}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                {shown < filtered.length ? (
                    <button
                        onClick={() => setShown((count) => count + PAGE_SIZE)}
                        className="cursor-pointer text-sm text-gray-400 hover:text-white transition-colors border-b border-white/15 hover:border-white/40 pb-0.5"
                    >
                        Show {Math.min(PAGE_SIZE, filtered.length - shown)} more
                        <span className="font-mono text-[11px] text-gray-600 ml-2">{n(filtered.length - shown)} left</span>
                    </button>
                ) : (
                    <span />
                )}

                {withheld.length > 0 && (
                    <p className="text-xs text-gray-600">
                        MyDramaList doesn&rsquo;t publish the {withheld.join(" or ")} {withheld.length === 1 ? "entry" : "entries"}.
                    </p>
                )}
            </div>
        </div>
    );
}
