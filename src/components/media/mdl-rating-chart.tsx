"use client";

import { useMemo, useState } from "react";
import { smoothPath } from "@/lib/smooth-path";

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

/**
 * @param headroom Leave air above and below the data rather than fitting the
 * domain to it exactly.
 *
 * Without it a series that only ever read 8.0 and 8.1 gets the domain [8.0,
 * 8.1], so its two values land on the top and bottom edges of the frame and a
 * single tenth is drawn as a cliff from ceiling to floor. The axis was labelled,
 * which is what made that honest — but honest and legible are different things,
 * and a line traced along the border of its own plot reads as a fault.
 *
 * The padding is a quarter of the data's span, floored at one whole tick and
 * always a multiple of one. Quantising it is the point: pad by a raw 0.3 and the
 * domain lands wherever it lands, and the axis grows labels like 7.73 for a
 * source that publishes tenths. A quarter-span keeps the shape — a series that
 * genuinely swings a full point still fills the plot — while the floor is what
 * rescues the flat ones, which are the whole problem.
 */
function scaleFor(values: number[], candidates: number[], headroom = false): Scale {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const flat = min === max;
    const span = max - min || candidates[0];
    const step = niceStep(span, candidates);
    // A flat series is padded whatever the caller asked for: with hi === lo
    // every point divides by zero and the line renders as NaN.
    const pad = headroom ? Math.max(Math.ceil((span * 0.25) / step), 1) * step : flat ? step : 0;
    // Nudged before rounding, because the division does not land clean: 8.2
    // minus 0.1 over 0.1 is 80.99999999999999, and floor takes that to 80 — the
    // domain loses a whole tick and the padding comes out lopsided. The same
    // drift the ticks below are rebuilt by multiplication to avoid.
    const EPS = 1e-9;
    const lo = Math.floor((min - pad) / step + EPS) * step;
    const hi = Math.ceil((max + pad) / step - EPS) * step;
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
 * **The x axis is time, not position, and it runs unbroken.** The sparkline in
 * the badge spaces its readings evenly because at 40px nothing else fits, but
 * that quietly claims every gap is the same width. Here a three-week silence has
 * to look like three weeks, or the chart lies about when the rating moved.
 *
 * This axis used to break, compressing a long flat tail into a stub so the
 * period where the rating actually moved kept most of the width. It was the
 * right shape for the data that existed when it was written — a burst of
 * backfilled readings and little since. It aged badly, and in the one direction
 * that was guaranteed: the tail is time passing, so it only ever grows. Three
 * weeks on, two days of movement were being given 78% of the plot while a
 * fortnight of genuine daily readings shared a stub, and the reading a viewer
 * took from it was the opposite of the truth. A rule that degrades every day it
 * runs is worse than no rule.
 *
 * **The line steps, and every actual reading gets a dot.** Between two readings
 * we know nothing, so the line carries the last observed value forward rather
 * than sloping — the standard convention, and the one that does not invent a
 * transition. The dots then say where we genuinely looked, which is the part a
 * step alone hides: a long flat run is not a stable rating, it is a stretch
 * where nobody asked.
 *
 * The rating's axis is close around its own range, which magnifies a movement
 * of a tenth into a visible climb. That is honest here, unlike in the badge,
 * precisely because the ticks are labelled — the reader can see the whole
 * chart spans 0.3 and judge accordingly. Close, but no longer flush: it keeps
 * a tick of air above and below so the line is never traced along the frame.
 * See `scaleFor`.
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

        // Headroom on the rating only. The audience is an area closed to the
        // baseline, and lifting its floor off the bottom of the plot would leave
        // the ground it is meant to be floating.
        const rating = scaleFor(
            rated.map((p) => p.rating),
            [0.1, 0.2, 0.5, 1, 2],
            true,
        );
        const yRating = (v: number) => PAD.t + PLOT_H - ((v - rating.lo) / (rating.hi - rating.lo)) * PLOT_H;

        const audience = watched.length > 1 ? scaleFor(watched.map((p) => p.watchers), [100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000]) : null;
        const yWatchers = (v: number) => (audience ? PAD.t + PLOT_H - ((v - audience.lo) / (audience.hi - audience.lo)) * PLOT_H : 0);

        // Both series curve now, through the same monotone interpolation.
        //
        // The audience was already sloped and this only softens it: a counter
        // that rises passes through everything in between, so a curve claims
        // nothing a straight line did not.
        //
        // The rating used to step, on the argument that it can rise and fall
        // and the honest claim is that the last figure held until we looked
        // again. That argument stands; the staircase was simply unreadable once
        // six months of daily readings arrived — a hundred and eighty risers
        // four pixels apart. What the curve costs is the values between the
        // readings: it passes through 8.27, and MDL publishes tenths. What
        // monotone interpolation buys back is that it invents no peak and no
        // trough — every turn on the drawn line was measured, and the dots mark
        // the days it actually moved.
        const curveOf = (list: { iso: string; v: number }[], y: (v: number) => number) =>
            smoothPath(list.map((p) => ({ x: xOf(p.iso), y: y(p.v) })));

        const ratingPath = curveOf(rated.map((p) => ({ iso: p.day, v: p.rating })), yRating);
        const watchersPath = audience ? curveOf(watched.map((p) => ({ iso: p.day, v: p.watchers })), yWatchers) : "";
        // Closed back along the baseline so the audience reads as ground under
        // the rating rather than as a second line competing with it.
        const closeArea = (path: string, list: { day: string }[]) =>
            path && list.length > 1
                ? `${path} L ${xOf(list[list.length - 1].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} L ${xOf(list[0].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} Z`
                : "";
        const watchersArea = audience ? closeArea(watchersPath, watched) : "";

        // Three date labels at most: the ends always, the middle only when the
        // span is wide enough that it is not crowding one of them.
        const xLabels =
            daySpan > 6
                ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]]
                : [points[0], points[points.length - 1]];

        // A dot where the rating changed, plus both ends — not one per reading.
        //
        // The dots used to mark every day we looked, which was worth saying
        // while readings were scarce. They are not scarce any more: MDL's
        // statistics page backfills a fortnight at a time, so six months of
        // history is a hundred and eighty readings and a hundred and eighty
        // dots four pixels apart, a wall of them along every plateau. And a
        // plateau is exactly where the dots say least — the value did not move,
        // and repeating that daily crowds out the moments it did.
        //
        // On a sparse series almost every reading is a change, so this barely
        // alters those. The count of readings stays in the section's header,
        // which is where "how often did we look" belongs.
        const dots = rated.filter((p, i) => i === 0 || i === rated.length - 1 || p.rating !== rated[i - 1].rating);

        return { dots, xOf, rating, yRating, audience, yWatchers, ratingPath, watchersArea, xLabels };
    }, [points]);

    const { dots, xOf, rating, yRating, audience, yWatchers, ratingPath, watchersArea, xLabels } = geometry;

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

                {/* A dot where the rating moved, and at both ends. */}
                {dots.map((p) => (
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
