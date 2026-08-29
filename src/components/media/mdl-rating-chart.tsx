"use client";

import { useMemo, useState } from "react";

export type ChartPoint = { day: string; rating: number | null; watchers: number | null };

const VB_W = 720;
const VB_H = 200;
const PAD = { l: 34, r: 46, t: 12, b: 24 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// From the string parts, never through Date: "2026-08-12" parsed as a Date is
// UTC midnight, and a viewer west of Greenwich would see it labelled the 11th.
function label(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

function dayNumber(iso: string): number {
    return Date.parse(`${iso}T00:00:00.000Z`) / 86_400_000;
}

function compact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}

/**
 * Picks a tick step that lands 3-5 gridlines on the axis.
 *
 * The candidates start at 0.1 because that is MDL's own resolution — a rating
 * cannot fall between two ticks finer than that, so a 0.05 gridline would be
 * an axis marking a value the data can never take.
 */
function niceStep(span: number, candidates: number[]): number {
    const target = span / 4;
    return candidates.find((c) => c >= target) ?? candidates[candidates.length - 1];
}

type Scale = { lo: number; hi: number; step: number; ticks: number[] };

function scaleFor(values: number[], candidates: number[], padByStep = true): Scale {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || candidates[0];
    const step = niceStep(span, candidates);
    const lo = Math.floor(min / step) * step - (padByStep && min === max ? step : 0);
    const hi = Math.ceil(max / step) * step + (padByStep && min === max ? step : 0);
    const ticks: number[] = [];
    // Rebuilt by multiplication rather than accumulated by addition: repeatedly
    // adding 0.1 drifts, and an axis labelled 8.299999999999999 is a bug on
    // display rather than in the data.
    const n = Math.round((hi - lo) / step);
    for (let i = 0; i <= n; i++) ticks.push(Math.round((lo + i * step) * 1000) / 1000);
    return { lo, hi, step, ticks };
}

/**
 * The rating over time, with the audience behind it.
 *
 * Two decisions carry most of this.
 *
 * **The x axis is time, not position.** The sparkline in the badge spaces its
 * readings evenly because at 40px nothing else fits, but that quietly claims
 * every gap is the same width. Here a three-week silence has to look like three
 * weeks, or the chart lies about when the rating moved.
 *
 * **The line steps, and every actual reading gets a dot.** Between two readings
 * we know nothing, so the line carries the last observed value forward rather
 * than sloping — the standard convention, and the one that does not invent a
 * transition. The dots then say where we genuinely looked, which is the part a
 * step alone hides: a long flat run is not a stable rating, it is a stretch
 * where nobody asked.
 *
 * The rating's axis is tight around its own range, which magnifies a movement
 * of a tenth into a visible climb. That is honest here, unlike in the badge,
 * precisely because the ticks are labelled — the reader can see the whole
 * chart spans 0.3 and judge accordingly.
 */
export function MdlRatingChart({ points }: { points: ChartPoint[] }) {
    const [hover, setHover] = useState<number | null>(null);

    const geometry = useMemo(() => {
        const rated = points.filter((p): p is ChartPoint & { rating: number } => p.rating != null);
        const watched = points.filter((p): p is ChartPoint & { watchers: number } => p.watchers != null);

        const days = points.map((p) => dayNumber(p.day));
        const firstDay = Math.min(...days);
        const lastDay = Math.max(...days);
        const daySpan = lastDay - firstDay || 1;

        const xOf = (iso: string) => PAD.l + ((dayNumber(iso) - firstDay) / daySpan) * PLOT_W;

        const rating = scaleFor(
            rated.map((p) => p.rating),
            [0.1, 0.2, 0.5, 1, 2],
        );
        const yRating = (v: number) => PAD.t + PLOT_H - ((v - rating.lo) / (rating.hi - rating.lo)) * PLOT_H;

        const audience = watched.length > 1 ? scaleFor(watched.map((p) => p.watchers), [100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000]) : null;
        const yWatchers = (v: number) => (audience ? PAD.t + PLOT_H - ((v - audience.lo) / (audience.hi - audience.lo)) * PLOT_H : 0);

        const stepPath = (list: { iso: string; v: number }[], y: (v: number) => number) => {
            if (list.length === 0) return "";
            let d = `M ${xOf(list[0].iso).toFixed(2)} ${y(list[0].v).toFixed(2)}`;
            for (let i = 1; i < list.length; i++) {
                d += ` L ${xOf(list[i].iso).toFixed(2)} ${y(list[i - 1].v).toFixed(2)} L ${xOf(list[i].iso).toFixed(2)} ${y(list[i].v).toFixed(2)}`;
            }
            return d;
        };

        const ratingPath = stepPath(rated.map((p) => ({ iso: p.day, v: p.rating })), yRating);
        const watchersPath = audience ? stepPath(watched.map((p) => ({ iso: p.day, v: p.watchers })), yWatchers) : "";
        // Closed back along the baseline so the audience reads as ground under
        // the rating rather than as a second line competing with it.
        const watchersArea =
            audience && watched.length > 1
                ? `${watchersPath} L ${xOf(watched[watched.length - 1].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} L ${xOf(watched[0].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} Z`
                : "";

        // Three date labels at most: the ends always, the middle only when the
        // span is wide enough that it is not crowding one of them.
        const xLabels =
            daySpan > 6
                ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]]
                : [points[0], points[points.length - 1]];

        return { rated, watched, xOf, rating, yRating, audience, yWatchers, ratingPath, watchersArea, xLabels };
    }, [points]);

    const { rated, xOf, rating, yRating, audience, yWatchers, ratingPath, watchersArea, xLabels } = geometry;

    const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // Back out of the viewBox scaling: the SVG is drawn at 720 units wide
        // and displayed at whatever the column happens to be.
        const vbX = ((e.clientX - rect.left) / rect.width) * VB_W;
        let best = 0;
        let bestD = Infinity;
        points.forEach((p, i) => {
            const d = Math.abs(xOf(p.day) - vbX);
            if (d < bestD) {
                bestD = d;
                best = i;
            }
        });
        setHover(best);
    };

    const active = hover != null ? points[hover] : null;
    const activeX = active ? xOf(active.day) : 0;
    // The readout is pinned inside the plot rather than centred on the cursor,
    // so it never hangs off the edge on the first or last reading.
    const readoutRight = activeX > PAD.l + PLOT_W * 0.6;

    return (
        <div className="w-full">
            <svg
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                className="w-full cursor-crosshair select-none"
                style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
            >
                {/* Gridlines and the rating axis, on the left */}
                {rating.ticks.map((t) => (
                    <g key={t}>
                        <line x1={PAD.l} y1={yRating(t)} x2={PAD.l + PLOT_W} y2={yRating(t)} stroke="currentColor" strokeWidth={1} className="text-white/6" />
                        <text x={PAD.l - 8} y={yRating(t) + 3.5} textAnchor="end" className="fill-gray-500 text-[10px] tabular-nums">
                            {t.toFixed(1)}
                        </text>
                    </g>
                ))}

                {/* The audience, as ground */}
                {audience && watchersArea && (
                    <>
                        <path d={watchersArea} className="fill-sky-500/8" />
                        {[audience.ticks[0], audience.ticks[audience.ticks.length - 1]].map((t) => (
                            <text key={t} x={PAD.l + PLOT_W + 8} y={yWatchers(t) + 3.5} textAnchor="start" className="fill-sky-500/40 text-[10px] tabular-nums">
                                {compact(t)}
                            </text>
                        ))}
                    </>
                )}

                {/* Dates */}
                {xLabels.map((p, i) => (
                    <text
                        key={p.day}
                        x={xOf(p.day)}
                        y={VB_H - 8}
                        textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
                        className="fill-gray-500 text-[10px]"
                    >
                        {label(p.day)}
                    </text>
                ))}

                {/* The rating itself */}
                <path d={ratingPath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-sky-400" />

                {/* One dot per actual reading — where the line is carried
                    forward and where it was genuinely observed. */}
                {rated.map((p) => (
                    <circle key={p.day} cx={xOf(p.day)} cy={yRating(p.rating)} r={2.5} className="fill-sky-300" />
                ))}

                {active && (
                    <g>
                        <line x1={activeX} y1={PAD.t} x2={activeX} y2={PAD.t + PLOT_H} stroke="currentColor" strokeWidth={1} className="text-fg-faint" />
                        {active.rating != null && <circle cx={activeX} cy={yRating(active.rating)} r={4} className="fill-sky-200" />}
                        <g transform={`translate(${readoutRight ? activeX - 96 : activeX + 8}, ${PAD.t + 4})`}>
                            <rect width={88} height={active.watchers != null ? 38 : 26} rx={4} className="fill-gray-950/90 stroke-white/10" strokeWidth={1} />
                            <text x={8} y={13} className="fill-gray-400 text-[9px]">
                                {label(active.day)}
                            </text>
                            {active.rating != null && (
                                <text x={8} y={24} className="fill-sky-300 text-[11px] font-semibold tabular-nums">
                                    {active.rating.toFixed(1)}
                                </text>
                            )}
                            {active.watchers != null && (
                                <text x={8} y={34} className="fill-gray-500 text-[9px] tabular-nums">
                                    {active.watchers.toLocaleString()} watchers
                                </text>
                            )}
                        </g>
                    </g>
                )}
            </svg>
        </div>
    );
}
