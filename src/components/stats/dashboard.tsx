"use client";

import { motion } from "framer-motion";
import { type DashboardStats } from "@/types/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Counter } from "./counter";
import { Play, Tv, Clock, CheckCircle2, BarChart3, Star, TrendingUp, Globe, Calendar, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const GENRE_COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

const COUNTRY_LABELS: Record<string, string> = {
    KR: "Korea", CN: "China", JP: "Japan", TW: "Taiwan", TH: "Thailand",
    HK: "Hong Kong", US: "USA", GB: "UK", FR: "France", PH: "Philippines", SG: "Singapore",
};

// Rating bar color: blue-ish for low, warming up toward top scores
const RATING_COLORS = [
    "#4b5563", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
    "#f43f5e", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
];

function buildHeatmapGrid(heatmap: { date: string; count: number }[]) {
    const countByDate = new Map(heatmap.map((h) => [h.date, h.count]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(start.getDate() - 364);
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: string; count: number }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    const cursor = new Date(start);
    for (let week = 0; week < 53; week++) {
        const days: { date: string; count: number }[] = [];
        for (let day = 0; day < 7; day++) {
            const dateStr = cursor.toISOString().slice(0, 10);
            const isFuture = cursor > today;
            days.push({ date: dateStr, count: isFuture ? -1 : (countByDate.get(dateStr) ?? 0) });

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
    if (count <= 2) return "bg-green-900/60";
    if (count <= 4) return "bg-green-700/70";
    if (count <= 7) return "bg-green-500/80";
    return "bg-green-400";
}

const CARD = "bg-linear-to-br from-white/5 to-white/1 backdrop-blur-sm border-white/10 hover:border-white/20 transition-all";

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
    const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
    const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const ratedItems = stats.ratingDistribution.reduce((s, r) => s + r.count, 0);
    const avgRating = ratedItems > 0
        ? (stats.ratingDistribution.reduce((s, r) => s + r.rating * r.count, 0) / ratedItems).toFixed(1)
        : "—";

    const totalHeatmapActions = stats.activityHeatmap.reduce((s, d) => s + d.count, 0);
    const { weeks, monthLabels } = buildHeatmapGrid(stats.activityHeatmap);
    const maxCountry = stats.countryBreakdown[0]?.count ?? 1;

    // Rating: only 1–10, no zero
    const ratingBars = stats.ratingDistribution.filter((r) => r.rating > 0);
    const maxRatingCount = Math.max(...ratingBars.map((r) => r.count), 1);

    // Year: keep last 15 years max to avoid crowding
    const recentYears = stats.yearBreakdown.slice(-15);
    const maxYearCount = Math.max(...recentYears.map((y) => y.count), 1);

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
            {/* Row 1 — Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {([
                    {
                        label: "Total Watched",
                        value: <Counter value={stats.totalMovies + stats.totalTV} />,
                        sub: `${stats.totalMovies} movies · ${stats.totalTV} series`,
                        icon: <Play className="h-7 w-7 text-blue-400 opacity-40" />,
                    },
                    {
                        label: "Watch Time",
                        value: <Counter value={watchTimeHours} suffix="h" />,
                        sub: `~${(stats.watchTimeMinutes / (60 * 24)).toFixed(1)} days`,
                        icon: <Clock className="h-7 w-7 text-purple-400 opacity-40" />,
                    },
                    {
                        label: "Avg Rating",
                        value: <span className="flex items-center gap-1.5"><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />{avgRating}</span>,
                        sub: "Out of 10",
                        icon: <TrendingUp className="h-7 w-7 text-yellow-400 opacity-40" />,
                    },
                    {
                        label: "Completion",
                        value: <Counter value={Math.round(stats.completionRate)} suffix="%" />,
                        sub: (
                            <div className="w-full bg-white/5 h-1 rounded-full mt-1.5 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.completionRate}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className="bg-linear-to-r from-green-500 to-emerald-500 h-full rounded-full"
                                />
                            </div>
                        ),
                        icon: <CheckCircle2 className="h-7 w-7 text-green-400 opacity-40" />,
                    },
                ] as const).map(({ label, value, sub, icon }, i) => (
                    <motion.div key={label} variants={item}>
                        <div className={`${CARD} rounded-xl border p-4 flex items-center justify-between gap-3`}>
                            <div className="min-w-0">
                                <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                                <p className="text-2xl font-bold text-white">{value}</p>
                                <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
                            </div>
                            <div className="shrink-0">{icon}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Row 2 — Most Seen Actors */}
            {stats.topActors.length > 0 && (
                <motion.div variants={item}>
                    <Card className={CARD}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <Users className="h-4 w-4 text-pink-400" />
                                Most Seen Actors
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {stats.topActors.map((actor) => (
                                    <Link key={actor.slug} href={actor.slug.startsWith("/") ? actor.slug : `/people/${actor.slug}`} className="group flex flex-col items-center gap-2 text-center">
                                        <div className="relative w-14 h-14 rounded-full overflow-hidden bg-white/5 ring-2 ring-white/10 group-hover:ring-primary/50 transition-all">
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
                                            <p className="text-xs font-medium text-white line-clamp-1 group-hover:text-blue-400 transition-colors">{actor.name}</p>
                                            <p className="text-[10px] text-gray-500">{actor.count} show{actor.count !== 1 ? "s" : ""}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Row 3 — Activity Heatmap */}
            <motion.div variants={item}>
                <Card className={CARD}>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2 text-white">
                            <Calendar className="h-4 w-4 text-green-400" />
                            Activity — past year
                            <span className="ml-auto text-xs font-normal text-gray-500">
                                {totalHeatmapActions} action{totalHeatmapActions !== 1 ? "s" : ""}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div>
                            <div>
                                {/* Month labels — same flex structure as the grid so they align perfectly */}
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
                                            {week.map((day, di) => (
                                                <div
                                                    key={di}
                                                    title={day.count >= 0 ? `${day.date}: ${day.count} action${day.count !== 1 ? "s" : ""}` : ""}
                                                    className={`w-full aspect-square rounded-[2px] ${cellColor(day.count)}`}
                                                />
                                            ))}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-1.5 mt-3 justify-end">
                                    <span className="text-[10px] text-gray-600">Less</span>
                                    {["bg-white/5", "bg-green-900/60", "bg-green-700/70", "bg-green-500/80", "bg-green-400"].map((c) => (
                                        <div key={c} className={`w-2.5 h-2.5 rounded-[2px] ${c}`} />
                                    ))}
                                    <span className="text-[10px] text-gray-600">More</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Row 3 — Rating Distribution + By Year (both bar charts, similar height) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rating Distribution — custom vertical bars */}
                <motion.div variants={item}>
                    <Card className={CARD}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <BarChart3 className="h-4 w-4 text-blue-400" />
                                Rating Distribution
                                <span className="ml-auto text-xs font-normal text-gray-500">{ratedItems} rated</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-1.5 h-32">
                                {ratingBars.map(({ rating, count }, i) => (
                                    <div key={rating} className="flex-1 flex flex-col items-center gap-1.5">
                                        {count > 0 && (
                                            <span className="text-[10px] text-gray-400 tabular-nums">{count}</span>
                                        )}
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${Math.max((count / maxRatingCount) * 96, count > 0 ? 4 : 0)}px` }}
                                            transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                                            className="w-full rounded-t-sm"
                                            style={{ backgroundColor: RATING_COLORS[rating] ?? "#4b5563", opacity: count === 0 ? 0.15 : 1 }}
                                        />
                                        <span className="text-[10px] text-gray-500">{rating}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Year — custom vertical bars */}
                {recentYears.length > 0 && (
                    <motion.div variants={item}>
                        <Card className={CARD}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-white">
                                    <Tv className="h-4 w-4 text-violet-400" />
                                    By Year
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-end gap-1 h-32">
                                    {recentYears.map(({ year, count }, i) => (
                                        <div key={year} className="flex-1 flex flex-col items-center gap-1">
                                            {count > 0 && (
                                                <span className="text-[10px] text-gray-400 tabular-nums">{count}</span>
                                            )}
                                            <motion.div
                                                initial={{ height: 0 }}
                                                animate={{ height: `${Math.max((count / maxYearCount) * 96, count > 0 ? 4 : 0)}px` }}
                                                transition={{ duration: 0.8, delay: i * 0.04, ease: "easeOut" }}
                                                className="w-full rounded-t-sm bg-linear-to-t from-violet-600 to-violet-400"
                                                style={{ opacity: count === 0 ? 0.15 : 1 }}
                                            />
                                            <span className="text-[10px] text-gray-500">{String(year).slice(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Row 4 — Top Genres + By Country (both lists, similar height) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Genres */}
                <motion.div variants={item}>
                    <Card className={CARD}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                                Top Genres
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.topGenres.length > 0 ? (
                                    stats.topGenres.map((genre, i) => (
                                        <div key={genre.name} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-white">{genre.name}</span>
                                                <span className="text-gray-400">{genre.count} titles</span>
                                            </div>
                                            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${genre.percentage}%` }}
                                                    transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                                                    className="h-full rounded-full"
                                                    style={{ background: `linear-gradient(90deg, ${GENRE_COLORS[i % GENRE_COLORS.length]}, ${GENRE_COLORS[(i + 1) % GENRE_COLORS.length]})` }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-8">No genre data yet</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* By Country */}
                {stats.countryBreakdown.length > 0 && (
                    <motion.div variants={item}>
                        <Card className={CARD}>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-white">
                                    <Globe className="h-4 w-4 text-sky-400" />
                                    By Country
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {stats.countryBreakdown.slice(0, 8).map(({ country, count }, i) => (
                                        <div key={country} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-white">{COUNTRY_LABELS[country] ?? country}</span>
                                                <span className="text-gray-400">{count}</span>
                                            </div>
                                            <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(count / maxCountry) * 100}%` }}
                                                    transition={{ duration: 1, delay: 0.1 + i * 0.07 }}
                                                    className="h-full rounded-full bg-linear-to-r from-sky-500 to-blue-500"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Row 5 — Continue Watching */}
            {continueWatching.length > 0 && (
                <motion.div variants={item}>
                    <Card className={CARD}>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2 text-white">
                                <Play className="h-4 w-4 text-blue-400" />
                                Continue Watching
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
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
                                                                className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-500 to-blue-400 rounded-full"
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
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </motion.div>
    );
}
