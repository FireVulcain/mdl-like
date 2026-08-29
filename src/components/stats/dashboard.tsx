"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { type DashboardStats } from "@/types/stats";
import { Counter } from "./counter";
import { HomeRowLabel } from "@/components/home-section-header";
import { mdlPersonHref } from "@/lib/person-links";
import { ACTION_COLOR, formatPayloadText, mediaHref } from "@/lib/activity-format";
import { getActivityForDay, type DayActivityEntry } from "@/actions/stats";
import { ImageOff, Star, Users, X } from "lucide-react";
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

// Every chart on this page plots a SINGLE series, so hue encodes nothing: there
// is no identity to tell apart. One accent carries all data marks, and section
// identity stays where it belongs — the coloured dot beside each header.
const DATA_MARK = "bg-sky-400";

// Radii on the marks themselves, deliberately outside the page's container
// vocabulary: a soft cap on the value end of a bar, and barely-eased corners on
// an 11px heatmap cell. These are chart specs, not chrome around a box, so they
// do not follow the containers when those change.
const BAR_CAP = "rounded-t-[4px]";
const CELL_CAP = "rounded-[2px]";

// Sequential ramp for magnitude: one hue, monotone lightness, brighter as the
// count grows (the anchor flips on a dark surface).
//
// The four data steps are literal hexes, not sky-900/700/500 with opacity,
// because those composited to 1.5–2.0:1 against the page — a day with 1–2
// actions was all but invisible. sky-900 at full opacity still lands on
// 1.97:1, missing the 2:1 floor by a hair. These four were derived against
// #101219 and pass all four ordinal checks (monotone L, adjacent ΔL ≥ 0.06,
// light end 2.35:1, hue spread 10°). Don't "tidy" them back into tokens
// without re-running the validator.
//
// Slot 0 is the empty day: a track, not a data step, so it stays recessive on
// purpose — filled cells are supposed to be what you see.
const HEAT_RAMP = ["bg-surface-2", "bg-[#03567f]", "bg-[#0075b4]", "bg-[#00a5ef]", "bg-[#00bcfe]"];

function cellColor(count: number) {
    if (count < 0) return "bg-transparent";
    if (count === 0) return HEAT_RAMP[0];
    if (count <= 2) return HEAT_RAMP[1];
    if (count <= 4) return HEAT_RAMP[2];
    if (count <= 7) return HEAT_RAMP[3];
    return HEAT_RAMP[4];
}

// Block header: accent dot + bold label, thin hairline, optional meta on the right
// One hue for the page, the same one the data wears. Each of the eight blocks
// used to pick its own — emerald, rose, yellow, fuchsia, violet, blue — and none
// of them meant anything: Top Genres was not greener than By Country was pink.
// The charts were unified on DATA_MARK a while back; these headings were missed.
function BlockHeader({ label, meta }: { label: string; meta?: string }) {
    return (
        <div className="space-y-2.5 mb-5">
            <div className="flex items-baseline justify-between gap-3">
                <HomeRowLabel dotClass={DATA_MARK} label={label} />
                {meta && <span className="text-xs text-fg-dim">{meta}</span>}
            </div>
            <div className="h-px w-full bg-surface-3" />
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
    // Heatmap day drill-down. Entries are fetched per click and cached by date,
    // so re-opening a day costs nothing.
    const [openActor, setOpenActor] = useState<string | null>(null);
    const openActorData = stats.topActors.find((a) => a.slug === openActor) ?? null;

    const [openDay, setOpenDay] = useState<{ date: string; label: string } | null>(null);
    const [dayCache, setDayCache] = useState<Record<string, DayActivityEntry[]>>({});
    const [loadingDay, setLoadingDay] = useState(false);

    async function toggleDay(date: string, label: string) {
        if (openDay?.date === date) return setOpenDay(null);
        setOpenDay({ date, label });
        if (dayCache[date]) return;
        setLoadingDay(true);
        try {
            const entries = await getActivityForDay(date, new Date().getTimezoneOffset());
            setDayCache((prev) => ({ ...prev, [date]: entries }));
        } finally {
            setLoadingDay(false);
        }
    }

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
                    <div key={label} className={`min-w-0 ${i > 0 ? "lg:border-l lg:border-line lg:pl-8" : ""}`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-dim">{label}</p>
                        {/* No tabular-nums here — Counter turns it on only while it
                            counts, and a large settled figure wants proportional digits */}
                        <p className="text-3xl md:text-4xl font-black tracking-tight text-fg mt-1.5">{value}</p>
                        <p className="text-xs text-fg-dim mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Activity heatmap */}
            <div>
                <BlockHeader
                    label="Activity"
                    meta={`${totalHeatmapActions} action${totalHeatmapActions !== 1 ? "s" : ""} this past year`}
                />
                <div className="flex gap-0.5 mb-1 h-4">
                    {weeks.map((_week, wi) => {
                        const ml = monthLabels.find((m) => m.col === wi);
                        return (
                            <div key={wi} className="flex-1 relative">
                                {ml && (
                                    <span className="absolute text-[10px] text-fg-dim whitespace-nowrap" style={{ left: 0 }}>
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
                                        <button
                                            type="button"
                                            disabled={day.count === 0}
                                            onClick={() => toggleDay(day.date, day.label)}
                                            aria-label={`${day.count} actions on ${day.label}`}
                                            // block + aspect-square, not h-full: a button is inline-block
                                            // with native appearance, so a percentage height doesn't
                                            // resolve against the wrapper the way the old div's did
                                            className={`block w-full aspect-square ${CELL_CAP} ring-white/60 group-hover/day:ring-1 ${cellColor(day.count)} ${
                                                day.count === 0 ? "cursor-default" : "cursor-pointer"
                                            } ${openDay?.date === day.date ? "ring-1 ring-white" : ""}`}
                                        />
                                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20 hidden group-hover/day:block whitespace-nowrap rounded-md border border-line-strong bg-panel px-2 py-1 text-[11px] shadow-lg shadow-black/50">
                                            <span className="font-semibold text-fg tabular-nums">
                                                {day.count} action{day.count !== 1 ? "s" : ""}
                                            </span>
                                            <span className="text-fg-muted"> · {day.label}</span>
                                        </span>
                                    </div>
                                ),
                            )}
                        </div>
                    ))}
                </div>
                {openDay && (
                    <div className="mt-4 rounded-lg border border-line-strong bg-surface-1 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <span className="text-sm font-semibold text-fg">{openDay.label}</span>
                            <div className="flex items-center gap-3 shrink-0">
                                <Link href="/history" className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                                    View all history
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setOpenDay(null)}
                                    aria-label="Close"
                                    className="text-fg-dim hover:text-fg transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {loadingDay && !dayCache[openDay.date] ? (
                            <p className="text-sm text-fg-dim">Loading…</p>
                        ) : (dayCache[openDay.date]?.length ?? 0) === 0 ? (
                            <p className="text-sm text-fg-dim">No activity on this day.</p>
                        ) : (
                            <ul className="space-y-2">
                                {dayCache[openDay.date].map((e) => (
                                    <li key={e.id}>
                                        <Link
                                            href={mediaHref(e.source, e.externalId)}
                                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 hover:bg-surface-2 transition-colors"
                                        >
                                            {e.poster ? (
                                                <Image
                                                    unoptimized
                                                    src={e.poster}
                                                    alt=""
                                                    width={28}
                                                    height={42}
                                                    className="h-10.5 w-7 rounded-md object-cover shrink-0"
                                                />
                                            ) : (
                                                <span className="h-10.5 w-7 rounded-md bg-surface-2 shrink-0" />
                                            )}
                                            <span
                                                className={`text-sm min-w-0 flex-1 ${ACTION_COLOR[e.action] ?? "text-fg-soft"}`}
                                                dangerouslySetInnerHTML={{
                                                    __html: formatPayloadText(e.action, e.payload, e.title),
                                                }}
                                            />
                                            <span className="text-xs text-fg-dim tabular-nums shrink-0">
                                                {new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                <div className="flex items-center gap-1.5 mt-3 justify-end">
                    <span className="text-[10px] text-fg-faint">Less</span>
                    {HEAT_RAMP.map((c) => (
                        <div key={c} className={`w-2.5 h-2.5 ${CELL_CAP} ${c}`} />
                    ))}
                    <span className="text-[10px] text-fg-faint">More</span>
                </div>
            </div>

            {/* Most seen actors */}
            {stats.topActors.length > 0 && (
                <div>
                    <BlockHeader label="Most Seen Actors" />
                    {/* The whole tile opens the breakdown rather than the profile: the
                        count alone was a 10px target nested inside the link, and the
                        number is easier to trust when you can see what makes it up.
                        The profile link moves into the panel, where it has room. */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-5">
                        {stats.topActors.map((actor) => {
                            const open = openActor === actor.slug;
                            return (
                                <button
                                    key={actor.slug}
                                    type="button"
                                    onClick={() => setOpenActor(open ? null : actor.slug)}
                                    aria-expanded={open}
                                    className="group flex flex-col items-center gap-2 text-center cursor-pointer"
                                >
                                    <div
                                        className={`relative w-14 h-14 rounded-full overflow-hidden bg-surface-2 ring-2 transition-all ${
                                            open ? "ring-sky-400" : "ring-line-strong group-hover:ring-sky-400/50"
                                        }`}
                                    >
                                        {actor.profileImage ? (
                                            <Image
                                                unoptimized
                                                src={actor.profileImage}
                                                alt={actor.name}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                                                <Users className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className={`text-xs font-medium line-clamp-1 transition-colors ${open ? "text-sky-300" : "text-fg group-hover:text-sky-300"}`}>
                                            {actor.name}
                                        </p>
                                        <p className="text-xs text-fg-dim">
                                            {actor.count} show{actor.count !== 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {openActorData && (
                        <div className="mt-5 rounded-lg border border-line-strong bg-surface-1 p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <span className="text-sm font-semibold text-fg">{openActorData.name}</span>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Link
                                        href={mdlPersonHref(openActorData.slug) ?? "#"}
                                        className="text-xs text-sky-300 hover:text-sky-200 transition-colors"
                                    >
                                        View profile
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setOpenActor(null)}
                                        aria-label="Close"
                                        className="text-fg-dim hover:text-fg transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                            <ul className="flex flex-wrap gap-3">
                                {openActorData.shows.map((s) => (
                                    <li key={s.href + s.title} className="w-20">
                                        <Link href={s.href} className="group/show block">
                                            <div className="relative w-20 aspect-2/3 rounded-lg overflow-hidden bg-surface-2 ring-1 ring-line-strong group-hover/show:ring-sky-400/50 transition-all">
                                                {s.poster ? (
                                                    <Image
                                                        unoptimized
                                                        src={s.poster}
                                                        alt={s.title}
                                                        fill
                                                        sizes="80px"
                                                        className="object-cover group-hover/show:scale-105 transition-transform duration-300"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                                                        <ImageOff className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-1.5 text-[11px] leading-snug text-fg-muted line-clamp-2 group-hover/show:text-fg transition-colors">
                                                {s.title}
                                            </p>
                                            {/* The year is what the list is ordered by, so it earns its place */}
                                            {s.year && <p className="text-[10px] text-fg-faint tabular-nums">{s.year}</p>}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Ratings + Years */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-14">
                <div>
                    <BlockHeader label="Your Ratings" meta={`${ratedItems} rated`} />
                    <div className="flex items-stretch gap-1.5 h-36 border-b border-line">
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
                                <div className="h-4 text-center text-[11px] leading-4 text-fg-muted tabular-nums">
                                    <span className="group-hover:hidden">{count === maxRatingCount && count > 0 ? count : ""}</span>
                                    <span className="hidden group-hover:inline">{count}</span>
                                </div>
                                <div className="relative flex-1">
                                    {/* Capped at 24px and centred, so the band's leftover is air.
                                        A bar that fills its slot reads as a thick saturated block. */}
                                    <div
                                        className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-6 ${BAR_CAP} ${DATA_MARK} transition-opacity group-hover:opacity-80`}
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
                            <span key={rating} className="flex-1 text-center text-[10px] text-fg-dim tabular-nums">{rating}</span>
                        ))}
                    </div>
                </div>

                {recentYears.length > 0 && (
                    <div>
                        <BlockHeader label="By Release Year" />
                        <div className="flex items-stretch gap-1 h-36 border-b border-line">
                            {recentYears.map(({ year, count }) => (
                                <Link
                                    key={year}
                                    href={`/watchlist?year=${year}`}
                                    aria-disabled={count === 0}
                                    className={`flex-1 flex flex-col group ${count === 0 ? "pointer-events-none" : ""}`}
                                    title={`${count} title${count !== 1 ? "s" : ""} from ${year}`}
                                >
                                    <div className="h-4 text-center text-[11px] leading-4 text-fg-muted tabular-nums">
                                        <span className="group-hover:hidden">{count === maxYearCount && count > 0 ? count : ""}</span>
                                        <span className="hidden group-hover:inline">{count}</span>
                                    </div>
                                    <div className="relative flex-1">
                                        {/* Same 24px cap as Your Ratings — see the note there */}
                                        <div
                                            className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-6 ${BAR_CAP} ${DATA_MARK} transition-opacity group-hover:opacity-80`}
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
                                <span key={year} className="flex-1 text-center text-[10px] text-fg-dim tabular-nums">
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
                    <BlockHeader label="Top Genres" />
                    <div className="space-y-3.5">
                        {stats.topGenres.length > 0 ? (
                            stats.topGenres.slice(0, listCount).map((genre) => (
                                <Link
                                    key={genre.name}
                                    href={`/watchlist?genre=${encodeURIComponent(genre.name)}`}
                                    className="block space-y-1.5 group -mx-2 px-2 py-1 rounded-lg hover:bg-surface-2 transition-colors"
                                >
                                    <div className="flex justify-between items-baseline text-sm">
                                        <span className="font-medium text-fg group-hover:text-sky-300 transition-colors">
                                            {genre.name}
                                        </span>
                                        <span className="text-xs text-fg-dim tabular-nums">{genre.count}</span>
                                    </div>
                                    <div className="relative h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${DATA_MARK}`} style={{ width: `${genre.percentage}%` }} />
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="text-sm text-fg-dim py-8">No genre data yet</p>
                        )}
                    </div>
                </div>

                {stats.countryBreakdown.length > 0 && (
                    <div>
                        <BlockHeader label="By Country" />
                        <div className="space-y-3.5">
                            {stats.countryBreakdown.slice(0, listCount).map(({ country, count }) => (
                                <div key={country} className="space-y-1.5 px-2 -mx-2 py-1">
                                    <div className="flex justify-between items-baseline text-sm">
                                        <span className="font-medium text-fg">{COUNTRY_LABELS[country] ?? country}</span>
                                        <span className="text-xs text-fg-dim tabular-nums">{count}</span>
                                    </div>
                                    <div className="relative h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${DATA_MARK}`} style={{ width: `${(count / maxCountry) * 100}%` }} />
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
                    <BlockHeader label="Top Themes" />
                    <div className="flex flex-wrap gap-2">
                        {stats.topThemes.map((theme) => {
                            const intensity = theme.count / stats.topThemes[0].count;
                            return (
                                <Link
                                    key={theme.name}
                                    href={`/watchlist?theme=${encodeURIComponent(theme.name)}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-[var(--chip-ink)] border hover:brightness-135 transition-all"
                                    style={{
                                        backgroundColor: `rgb(var(--chip-rgb) / ${0.08 + intensity * 0.22})`,
                                        borderColor: `rgb(var(--chip-rgb) / ${0.15 + intensity * 0.35})`,
                                    }}
                                >
                                    {theme.name}
                                    <span className="text-xs text-[var(--chip-ink-soft)]">{theme.count}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Continue watching */}
            {continueWatching.length > 0 && (
                <div>
                    <BlockHeader label="Continue Watching" />
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
                                                <div className="flex justify-between text-xs text-white/80">
                                                    <span>Ep {show.progress} / {show.totalEp}</span>
                                                    <span>{Math.round(progressPercent)}%</span>
                                                </div>
                                                <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className={`absolute inset-y-0 left-0 ${DATA_MARK} rounded-full`}
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
