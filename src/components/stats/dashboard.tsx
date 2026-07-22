"use client";

import { useMemo, useSyncExternalStore } from "react";
import { type DashboardStats } from "@/types/stats";
import { Counter } from "./counter";
import { HomeRowLabel } from "@/components/home-section-header";
import { Star, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const COUNTRY_LABELS: Record<string, string> = {
    KR: "Korea", CN: "China", JP: "Japan", TW: "Taiwan", TH: "Thailand",
    HK: "Hong Kong", US: "USA", GB: "UK", FR: "France", PH: "Philippines", SG: "Singapore",
};

// YYYY-MM-DD in the viewer's timezone — toISOString() would convert to UTC and
// file a 00:30 local session under the previous day
function localDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildHeatmapGrid(timestamps: string[]) {
    const countByDate = new Map<string, number>();
    for (const ts of timestamps) {
        const key = localDateKey(new Date(ts));
        countByDate.set(key, (countByDate.get(key) ?? 0) + 1);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: string; count: number; label: string }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(start);
    for (let week = 0; week < 53; week++) {
        const days: { date: string; count: number; label: string }[] = [];
        for (let day = 0; day < 7; day++) {
            const dateStr = localDateKey(cursor);
            const isFuture = cursor > today;
            days.push({
                date: dateStr,
                count: isFuture ? -1 : (countByDate.get(dateStr) ?? 0),
                // Pre-formatted here so the tooltip doesn't build 371 Dates at render
                label: cursor.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            });

            const month = cursor.getMonth();
            if (day === 0 && month !== lastMonth) {
                monthLabels.push({ label: cursor.toLocaleDateString("en-US", { month: "short" }), col: week });
                lastMonth = month;
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        weeks.push(days);
    }

    return { weeks, monthLabels };
}

function cellColor(count: number) {
    if (count < 0) return "bg-transparent";
    if (count === 0) return "bg-white/5";
    if (count <= 2) return "bg-emerald-900/70";
    if (count <= 4) return "bg-emerald-700/80";
    if (count <= 7) return "bg-emerald-500/90";
    return "bg-emerald-400";
}

// Block header: accent dot + bold label, thin hairline, optional meta on the right
function BlockHeader({ dotClass, label, meta }: { dotClass: string; label: string; meta?: string }) {
    return (
        <div className="space-y-2.5 mb-5">
            <div className="flex items-baseline justify-between gap-3">
                <HomeRowLabel dotClass={dotClass} label={label} />
                {meta && <span className="text-xs text-gray-500">{meta}</span>}
            </div>
            <div className="h-px w-full bg-linear-to-r from-white/10 to-transparent" />
        </div>
    );
}

interface StatsDashboardProps {
    stats: DashboardStats;
    continueWatching?: Array<{
        id: string;
        title: string | null;
        poster: string;
        backdrop?: string | null;
        progress: number;
        totalEp: number;
        externalId: string;
        source: string;
    }>;
}

export function StatsDashboard({ stats, continueWatching = [] }: StatsDashboardProps) {
    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const ratedItems = stats.ratingDistribution.reduce((s, r) => s + r.count, 0);
    const avgRating = ratedItems > 0
        ? (stats.ratingDistribution.reduce((s, r) => s + r.rating * r.count, 0) / ratedItems).toFixed(1)
        : "—";

    // Days are the viewer's, so the grid can only be built in the browser. During SSR
    // it renders empty (same structure) and fills in on hydration — no mismatch.
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
    const totalHeatmapActions = stats.activityTimestamps.length;
    const { weeks, monthLabels } = useMemo(
        () => buildHeatmapGrid(isClient ? stats.activityTimestamps : []),
        [stats.activityTimestamps, isClient],
    );
    const listCount = Math.min(stats.topGenres.length, stats.countryBreakdown.length, 8);
    const maxCountry = stats.countryBreakdown[0]?.count ?? 1;

    // Rating: only 1–10, no zero
    const ratingBars = stats.ratingDistribution.filter((r) => r.rating > 0);
    const maxRatingCount = Math.max(...ratingBars.map((r) => r.count), 1);

    // Year: keep last 15 years max to avoid crowding
    const recentYears = stats.yearBreakdown.slice(-15);
    const maxYearCount = Math.max(...recentYears.map((y) => y.count), 1);

    return (
        <div className="space-y-14 animate-in fade-in duration-500">
            {/* Hero numbers — bare figures, no cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
                {([
                    {
                        label: "Total watched",
                        value: <Counter value={stats.totalMovies + stats.totalTV} />,
                        sub: `${stats.totalMovies} movies · ${stats.totalTV} series`,
                    },
                    {
                        label: "Watch time",
                        value: <Counter value={watchTimeHours} suffix="h" />,
                        sub: `≈ ${(stats.watchTimeMinutes / (60 * 24)).toFixed(1)} days`,
                    },
                    {
                        label: "Average rating",
                        value: (
                            <span className="inline-flex items-baseline gap-2">
                                {avgRating}
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 self-center" />
                            </span>
                        ),
                        sub: `${ratedItems} titles rated`,
                    },
                    {
                        label: "Completion",
                        value: <Counter value={Math.round(stats.completionRate)} suffix="%" />,
                        sub: "of everything started",
                    },
                ] as const).map(({ label, value, sub }, i) => (
                    <div key={label} className={`min-w-0 ${i > 0 ? "lg:border-l lg:border-white/8 lg:pl-8" : ""}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
                        <p className="text-3xl md:text-4xl font-black tracking-tight text-white tabular-nums mt-1.5">{value}</p>
                        <p className="text-xs text-gray-500 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Activity heatmap */}
            <div>
                <BlockHeader
                    dotClass="bg-emerald-400"
                    label="Activity"
                    meta={`${totalHeatmapActions} action${totalHeatmapActions !== 1 ? "s" : ""} this past year`}
                />
                <div className="flex gap-0.5 mb-1 h-4">
                    {weeks.map((_week, wi) => {
                        const ml = monthLabels.find((m) => m.col === wi);
                        return (
                            <div key={wi} className="flex-1 relative">
                                {ml && (
                                    <span className="absolute text-[10px] text-gray-500 whitespace-nowrap" style={{ left: 0 }}>
                                        {ml.label}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="flex gap-0.5">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex-1 flex flex-col gap-0.5">
                            {week.map((day, di) =>
                                day.count < 0 ? (
                                    <div key={di} className="w-full aspect-square" />
                                ) : (
                                    <div key={di} className="relative group/day w-full aspect-square">
                                        <div
                                            className={`w-full h-full rounded-[2px] ring-white/60 group-hover/day:ring-1 ${cellColor(day.count)}`}
                                        />
                                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover/day:block whitespace-nowrap rounded-md border border-white/10 bg-gray-900 px-2 py-1 text-[11px] shadow-lg shadow-black/50">
                                            <span className="font-semibold text-white tabular-nums">
                                                {day.count} action{day.count !== 1 ? "s" : ""}
                                            </span>
                                            <span className="text-gray-400"> · {day.label}</span>
                                        </span>
                                    </div>
                                ),
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex items-center gap-1.5 mt-3 justify-end">
                    <span className="text-[10px] text-gray-600">Less</span>
                    {["bg-white/5", "bg-emerald-900/70", "bg-emerald-700/80", "bg-emerald-500/90", "bg-emerald-400"].map((c) => (
                        <div key={c} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
                    ))}
                    <span className="text-[10px] text-gray-600">More</span>
                </div>
            </div>

            {/* Most seen actors */}
            {stats.topActors.length > 0 && (
                <div>
                    <BlockHeader dotClass="bg-rose-400" label="Most Seen Actors" />
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-5">
                        {stats.topActors.map((actor) => (
                            <Link key={actor.slug} href={actor.slug.startsWith("/") ? actor.slug : `/people/${actor.slug}`} className="group flex flex-col items-center gap-2 text-center">
                                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-rose-400/50 transition-all">
                                    {actor.profileImage ? (
                                        <Image
                                            unoptimized
                                            src={actor.profileImage}
                                            alt={actor.name}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                            <Users className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-white line-clamp-1 group-hover:text-rose-300 transition-colors">{actor.name}</p>
                                    <p className="text-[10px] text-gray-500">{actor.count} show{actor.count !== 1 ? "s" : ""}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* Ratings + Years */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-14">
                <div>
                    <BlockHeader dotClass="bg-yellow-400" label="Your Ratings" meta={`${ratedItems} rated`} />
                    <div className="flex items-stretch gap-1.5 h-36 border-b border-white/8">
                        {ratingBars.map(({ rating, count }) => (
                            <Link
                                key={rating}
                                href={`/watchlist?score=${rating}`}
                                aria-disabled={count === 0}
                                className={`flex-1 flex flex-col group ${count === 0 ? "pointer-events-none" : ""}`}
                                title={`${count} title${count !== 1 ? "s" : ""} rated ${rating}`}
                            >
                                {/* Fixed label slot, outside the plot area — otherwise the labelled
                                    bar gets squeezed and renders shorter than shorter neighbours */}
                                <div className="h-4 text-center text-[11px] leading-4 text-gray-400 tabular-nums">
                                    <span className="group-hover:hidden">{count === maxRatingCount && count > 0 ? count : ""}</span>
                                    <span className="hidden group-hover:inline">{count}</span>
                                </div>
                                <div className="relative flex-1">
                                    <div
                                        className="absolute inset-x-0 bottom-0 rounded-t-lg bg-yellow-400 transition-opacity group-hover:opacity-80"
                                        style={{
                                            height: `${Math.max((count / maxRatingCount) * 100, count > 0 ? 3 : 0)}%`,
                                            opacity: count === 0 ? 0.12 : undefined,
                                        }}
                                    />
                                </div>
                            </Link>
                        ))}
                    </div>
                    <div className="flex gap-1.5 mt-1.5">
                        {ratingBars.map(({ rating }) => (
                            <span key={rating} className="flex-1 text-center text-[10px] text-gray-500 tabular-nums">{rating}</span>
                        ))}
                    </div>
                </div>

                {recentYears.length > 0 && (
                    <div>
                        <BlockHeader dotClass="bg-fuchsia-400" label="By Release Year" />
                        <div className="flex items-stretch gap-1 h-36 border-b border-white/8">
                            {recentYears.map(({ year, count }) => (
                                <Link
                                    key={year}
                                    href={`/watchlist?year=${year}`}
                                    aria-disabled={count === 0}
                                    className={`flex-1 flex flex-col group ${count === 0 ? "pointer-events-none" : ""}`}
                                    title={`${count} title${count !== 1 ? "s" : ""} from ${year}`}
                                >
                                    <div className="h-4 text-center text-[11px] leading-4 text-gray-400 tabular-nums">
                                        <span className="group-hover:hidden">{count === maxYearCount && count > 0 ? count : ""}</span>
                                        <span className="hidden group-hover:inline">{count}</span>
                                    </div>
                                    <div className="relative flex-1">
                                        <div
                                            className="absolute inset-x-0 bottom-0 rounded-t-lg bg-fuchsia-400 transition-opacity group-hover:opacity-80"
                                            style={{
                                                height: `${Math.max((count / maxYearCount) * 100, count > 0 ? 3 : 0)}%`,
                                                opacity: count === 0 ? 0.12 : undefined,
                                            }}
                                        />
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <div className="flex gap-1 mt-1.5">
                            {recentYears.map(({ year }) => (
                                <span key={year} className="flex-1 text-center text-[10px] text-gray-500 tabular-nums">
                                    {String(year).slice(2)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Genres + Countries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-14">
                <div>
                    <BlockHeader dotClass="bg-emerald-400" label="Top Genres" />
                    <div className="space-y-3.5">
                        {stats.topGenres.length > 0 ? (
                            stats.topGenres.slice(0, listCount).map((genre) => (
                                <Link
                                    key={genre.name}
                                    href={`/watchlist?genre=${encodeURIComponent(genre.name)}`}
                                    className="block space-y-1.5 group -mx-2 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex justify-between items-baseline text-sm">
                                        <span className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                                            {genre.name}
                                        </span>
                                        <span className="text-xs text-gray-500 tabular-nums">{genre.count}</span>
                                    </div>
                                    <div className="relative h-1 w-full bg-white/6 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${genre.percentage}%` }} />
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 py-8">No genre data yet</p>
                        )}
                    </div>
                </div>

                {stats.countryBreakdown.length > 0 && (
                    <div>
                        <BlockHeader dotClass="bg-rose-400" label="By Country" />
                        <div className="space-y-3.5">
                            {stats.countryBreakdown.slice(0, listCount).map(({ country, count }) => (
                                <div key={country} className="space-y-1.5 px-2 -mx-2 py-1">
                                    <div className="flex justify-between items-baseline text-sm">
                                        <span className="font-medium text-white">{COUNTRY_LABELS[country] ?? country}</span>
                                        <span className="text-xs text-gray-500 tabular-nums">{count}</span>
                                    </div>
                                    <div className="relative h-1 w-full bg-white/6 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${(count / maxCountry) * 100}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Themes */}
            {stats.topThemes.length > 0 && (
                <div>
                    <BlockHeader dotClass="bg-violet-400" label="Top Themes" />
                    <div className="flex flex-wrap gap-2">
                        {stats.topThemes.map((theme) => {
                            const intensity = theme.count / stats.topThemes[0].count;
                            return (
                                <Link
                                    key={theme.name}
                                    href={`/watchlist?theme=${encodeURIComponent(theme.name)}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-violet-200 border hover:brightness-135 transition-all"
                                    style={{
                                        backgroundColor: `rgba(139, 92, 246, ${0.08 + intensity * 0.22})`,
                                        borderColor: `rgba(139, 92, 246, ${0.15 + intensity * 0.35})`,
                                    }}
                                >
                                    {theme.name}
                                    <span className="text-xs text-violet-300/60">{theme.count}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Continue watching */}
            {continueWatching.length > 0 && (
                <div>
                    <BlockHeader dotClass="bg-blue-400" label="Continue Watching" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {continueWatching.slice(0, 6).map((show) => {
                            const progressPercent = (show.progress / show.totalEp) * 100;
                            return (
                                <Link key={show.id} href={`/media/${show.source.toLowerCase()}-${show.externalId}`} className="group">
                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
                                        {(show.backdrop || show.poster) && (
                                            <Image
                                                unoptimized
                                                src={show.backdrop || show.poster}
                                                alt={show.title ?? ""}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                            <p className="text-white font-semibold text-sm mb-2 line-clamp-1">{show.title}</p>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-xs text-gray-300">
                                                    <span>Ep {show.progress} / {show.totalEp}</span>
                                                    <span>{Math.round(progressPercent)}%</span>
                                                </div>
                                                <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-blue-400 rounded-full"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
