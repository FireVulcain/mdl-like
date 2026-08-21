"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Eye, CheckCircle, PauseCircle, Clock, XCircle, HelpCircle, Star } from "lucide-react";
import type { KuryanaDramaListItem, KuryanaDramaListSection } from "@/lib/kuryana";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MdlTitlePreview } from "@/components/mdl-title-preview";

export type ListSection = { key: string; label: string; section: KuryanaDramaListSection };

const ALL = "__all__";

/**
 * Status hues, icons included, mirroring STATUS_CONFIG in add-to-list-button.
 *
 * Someone else's list uses the same five words this app already colours on every
 * watchlist row and every media page, so it colours them the same way. Only
 * "Undecided" is new — MDL has it and the app does not — and it takes the
 * neutral treatment rather than borrowing a hue that means something else here.
 */
const STATUS: Record<string, { icon: React.ElementType; active: string; dot: string }> = {
    Watching: { icon: Eye, active: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30", dot: "bg-blue-400" },
    Completed: { icon: CheckCircle, active: "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30", dot: "bg-emerald-400" },
    "On-hold": { icon: PauseCircle, active: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30", dot: "bg-amber-400" },
    "Plan to Watch": { icon: Clock, active: "bg-slate-500/20 text-slate-300 ring-1 ring-slate-500/30", dot: "bg-slate-400" },
    Dropped: { icon: XCircle, active: "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30", dot: "bg-rose-400" },
    Undecided: { icon: HelpCircle, active: "bg-white/10 text-white ring-1 ring-white/15", dot: "bg-white/40" },
};

const NEUTRAL_ACTIVE = "bg-white/10 text-white ring-1 ring-white/15";
const IDLE = "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white";

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

function Row({ entry, href, showStatus }: { entry: Entry; href: string; showStatus: boolean }) {
    const score = parseFloat(entry.score);
    // "0.0" is MDL for "not rated", not a rating of zero.
    const rated = Number.isFinite(score) && score > 0;

    const seen = parseInt(entry.episode_seen, 10) || 0;
    const total = parseInt(entry.episode_total, 10) || 0;
    const partial = total > 0 && seen > 0 && seen < total;

    return (
        <Link
            href={href}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
        >
            {/* Only when the list is mixed. Filtered to one status, a dot on
                every row would repeat the filter back at the reader. */}
            {showStatus && (
                <span
                    className={`size-1.5 rounded-full shrink-0 ${STATUS[entry.status]?.dot ?? "bg-white/20"}`}
                    title={entry.status}
                />
            )}

            {/* The card hangs off the title, not the row: a row spans the page,
                so anchoring to it threw the card against the right edge. */}
            <span className="min-w-0 flex-1">
                <MdlTitlePreview slug={entry.id}>
                    <span className="block w-fit max-w-full truncate text-sm text-gray-300 group-hover:text-white transition-colors">
                        {entry.name}
                    </span>
                </MdlTitlePreview>
            </span>

            {/* Sized for the worst case the data holds — a 1265/1265 run beside
                a 10.0 score — so the two columns stay aligned down the page. */}
            <span className="w-20 shrink-0 text-right text-xs tabular-nums text-gray-500">
                {total > 0 ? (
                    <>
                        <span className={partial ? "text-gray-300" : ""}>{seen}</span>
                        <span className="text-gray-600">/{total}</span>
                    </>
                ) : (
                    <span className="text-gray-700">—</span>
                )}
            </span>

            {/* The same star the watchlist puts beside your own score, so a
                member's rating reads as a rating and not as another count. */}
            <span className={`w-14 shrink-0 flex items-center justify-end gap-1 text-xs font-medium tabular-nums ${rated ? "text-amber-400" : "text-gray-700"}`}>
                {rated ? (
                    <>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {score.toFixed(1)}
                    </>
                ) : (
                    "—"
                )}
            </span>
        </Link>
    );
}

export function MdlUserList({
    sections,
    hrefBySlug = {},
}: {
    sections: ListSection[];
    /** Titles already linked to a TMDB entry point at our own page instead. */
    hrefBySlug?: Record<string, string>;
}) {
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
    const grouped = active === ALL && !query.trim();

    // skipDelayDuration 0 so every row waits its own delay. Radix otherwise opens
    // the next tooltip instantly for 300ms after one has shown, which on a list
    // means a request for every title the pointer crosses on its way down.
    return (
        <TooltipProvider skipDelayDuration={0}>
        <div className="space-y-6">
            {/* The figures, as a sentence rather than as a scoreboard. They
                follow the filter, so they describe what is on screen. */}
            <p className="text-sm text-gray-500">
                <span className="text-gray-300 font-medium tabular-nums">{n(titles)}</span> titles
                <span className="mx-2 text-gray-700">·</span>
                <span className="text-gray-300 font-medium tabular-nums">{n(Math.round(episodes))}</span> episodes
                <span className="mx-2 text-gray-700">·</span>
                <span className="text-gray-300 font-medium tabular-nums">{days.toFixed(1)}</span> days watched
            </p>

            {/* Toolbar, same surface the watchlist uses: one panel holding the
                controls, so the chrome sits around what you operate rather than
                around what you read. */}
            <div className="relative">
                <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-xl rounded-lg border border-white/5" />
                <div className="relative flex flex-wrap items-center gap-2 p-2.5">
                    <div className="w-full md:flex-1 md:min-w-52 relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-sky-400 transition-colors" />
                        <input
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setShown(PAGE_SIZE);
                            }}
                            placeholder="Filter titles..."
                            aria-label="Filter titles"
                            className="w-full h-9 pl-9 pr-4 bg-white/5 rounded-lg text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-sky-500/50 focus:bg-white/8 transition-all"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto scrollbar-none pb-0.5 md:pb-0">
                        {[{ key: ALL, label: "All" }, ...sections.map((s) => ({ key: s.label, label: s.label }))].map((tab) => {
                            const isActive = tab.key === active;
                            const count =
                                tab.key === ALL
                                    ? sections.reduce((sum, s) => sum + titleCount(s.section), 0)
                                    : titleCount(sections.find((s) => s.label === tab.key)!.section);
                            const conf = STATUS[tab.label];
                            const Icon = conf?.icon;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => select(tab.key)}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer shrink-0 ${
                                        isActive ? (conf?.active ?? NEUTRAL_ACTIVE) : IDLE
                                    }`}
                                >
                                    {Icon && <Icon className="h-3.5 w-3.5" />}
                                    {tab.label}
                                    <span className="text-xs tabular-nums opacity-60">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* The archive. Grouped by status only when nothing is filtered —
                a search already narrows it, and headings would fragment the few
                results it leaves. */}
            {visible.length > 0 ? (
                <div className="-mx-3">
                    {visible.map((entry, i) => {
                        const startsGroup = grouped && entry.status !== visible[i - 1]?.status;
                        return (
                            <div key={`${entry.status}-${entry.id}-${entry.name}`}>
                                {startsGroup && (
                                    <div className={`flex items-center gap-3 px-3 pb-2 ${i === 0 ? "" : "pt-8"}`}>
                                        <h2 className="font-display text-lg font-semibold text-white">{entry.status}</h2>
                                        <span className="text-sm text-gray-400">
                                            ({scoped.filter((e) => e.status === entry.status).length})
                                        </span>
                                        <div className="flex-1 h-px bg-white/8" />
                                    </div>
                                )}
                                <Row entry={entry} href={hrefBySlug[entry.id] ?? `/media/mdl-${entry.id}`} showStatus={grouped} />
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="py-12 text-center text-sm text-gray-500">
                    {query.trim() ? `No title matches “${query.trim()}”.` : "Nothing listed here."}
                </p>
            )}

            {(shown < filtered.length || withheld.length > 0) && (
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/8">
                    {shown < filtered.length ? (
                        <button
                            onClick={() => setShown((count) => count + PAGE_SIZE)}
                            className="h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                        >
                            Show {Math.min(PAGE_SIZE, filtered.length - shown)} more
                            <span className="text-xs tabular-nums opacity-60">{n(filtered.length - shown)} left</span>
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
            )}
        </div>
        </TooltipProvider>
    );
}
