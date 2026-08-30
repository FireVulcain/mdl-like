"use client";

import { useMemo, useState } from "react";

export type ChartPoint = { day: string; rating: number | null; watchers: number | null };

const VB_W = 720;
const VB_H = 200;
const PAD = { l: 34, r: 46, t: 12, b: 24 };
const PLOT_W = VB_W - PAD.l - PAD.r;
const PLOT_H = VB_H - PAD.t - PAD.b;

/**
 * When a rating stops moving, the chart stops giving its flat run full width.
 *
 * A title that wobbled for three days and has held the same figure ever since
 * would otherwise draw that wobble into one per cent of the plot and spend the
 * remaining ninety-nine on a horizontal line. The history is still worth
 * showing — it just has to be shown at a size where it can be read.
 *
 * So the axis breaks: the period where something happened keeps most of the
 * width, and the flat run that follows is compressed into a stub after a
 * visible gap. A broken axis has to be signposted or it simply lies about time,
 * hence the gap, the slashes drawn in it, and the label saying how long the
 * compressed stretch actually is.
 *
 * Only worth doing when the tail genuinely dominates — below these two
 * thresholds the chart is legible as it stands and a break would be noise.
 */
const TAIL_MIN_DAYS = 14;
const TAIL_MIN_SHARE = 0.55;

const ACTIVE_SHARE = 0.78;
const GAP_SHARE = 0.06;

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

        // Where the rating last changed. Everything after it is one long run of
        // the same figure, and that run is what the break compresses.
        let tailStart = rated.length - 1;
        if (rated.length > 1) {
            const finalRating = rated[rated.length - 1].rating;
            while (tailStart > 0 && rated[tailStart - 1].rating === finalRating) tailStart--;
        }
        const breakDay = rated.length ? dayNumber(rated[tailStart].day) : firstDay;
        const tailDays = lastDay - breakDay;
        const broken = rated.length > 1 && tailDays >= TAIL_MIN_DAYS && tailDays / daySpan >= TAIL_MIN_SHARE;

        const activeW = broken ? PLOT_W * ACTIVE_SHARE : PLOT_W;
        const gapW = broken ? PLOT_W * GAP_SHARE : 0;
        const stubW = broken ? PLOT_W - activeW - gapW : 0;
        const activeSpan = broken ? breakDay - firstDay || 1 : daySpan;

        // Piecewise: real time on the left, compressed time after the break.
        const xOf = (iso: string) => {
            const d = dayNumber(iso);
            if (!broken) return PAD.l + ((d - firstDay) / daySpan) * PLOT_W;
            if (d <= breakDay) return PAD.l + ((d - firstDay) / activeSpan) * activeW;
            return PAD.l + activeW + gapW + ((d - breakDay) / (tailDays || 1)) * stubW;
        };

        const rating = scaleFor(
            rated.map((p) => p.rating),
            [0.1, 0.2, 0.5, 1, 2],
        );
        const yRating = (v: number) => PAD.t + PLOT_H - ((v - rating.lo) / (rating.hi - rating.lo)) * PLOT_H;

        const audience = watched.length > 1 ? scaleFor(watched.map((p) => p.watchers), [100, 250, 500, 1000, 2500, 5000, 10_000, 25_000, 50_000, 100_000]) : null;
        const yWatchers = (v: number) => (audience ? PAD.t + PLOT_H - ((v - audience.lo) / (audience.hi - audience.lo)) * PLOT_H : 0);

        // Two shapes, because the two series know different things about the
        // days between their readings.
        //
        // A rating steps. It can rise and fall, so between 8.2 on Monday and
        // 8.4 the next Monday it may well have gone through 8.0 — a straight
        // line would assert a climb that never happened, and the only honest
        // claim is that the last figure held until we looked again.
        //
        // The audience slopes. It is a counter that only ever goes up, so
        // between 11,000 and 12,400 we know for certain it passed through every
        // figure in between, in order. Here the step is the lie: it draws six
        // flat days and then fourteen hundred people arriving in one afternoon.
        // This matters most where readings are sparsest, which is exactly where
        // watchers are — measured at 2.1 readings per title against 9.8
        // ratings, because only a title's own detail page carries the audience.
        const stepPath = (list: { iso: string; v: number }[], y: (v: number) => number) => {
            if (list.length === 0) return "";
            let d = `M ${xOf(list[0].iso).toFixed(2)} ${y(list[0].v).toFixed(2)}`;
            for (let i = 1; i < list.length; i++) {
                d += ` L ${xOf(list[i].iso).toFixed(2)} ${y(list[i - 1].v).toFixed(2)} L ${xOf(list[i].iso).toFixed(2)} ${y(list[i].v).toFixed(2)}`;
            }
            return d;
        };

        const slopePath = (list: { iso: string; v: number }[], y: (v: number) => number) => {
            if (list.length === 0) return "";
            return list.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(p.iso).toFixed(2)} ${y(p.v).toFixed(2)}`).join(" ");
        };

        // Split at the break so nothing is drawn across the gap — a line
        // spanning it would undo the very thing the gap is there to say.
        const beforeBreak = <T extends { day: string }>(list: T[]) => (broken ? list.filter((p) => dayNumber(p.day) <= breakDay) : list);
        const afterBreak = <T extends { day: string }>(list: T[]) => (broken ? list.filter((p) => dayNumber(p.day) >= breakDay) : []);

        const ratingPath = stepPath(beforeBreak(rated).map((p) => ({ iso: p.day, v: p.rating })), yRating);
        const ratingTailPath = stepPath(afterBreak(rated).map((p) => ({ iso: p.day, v: p.rating })), yRating);
        const watchersPath = audience ? slopePath(beforeBreak(watched).map((p) => ({ iso: p.day, v: p.watchers })), yWatchers) : "";
        const watchersTailPath = audience ? slopePath(afterBreak(watched).map((p) => ({ iso: p.day, v: p.watchers })), yWatchers) : "";
        // Closed back along the baseline so the audience reads as ground under
        // the rating rather than as a second line competing with it.
        const closeArea = (path: string, list: { day: string }[]) =>
            path && list.length > 1
                ? `${path} L ${xOf(list[list.length - 1].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} L ${xOf(list[0].day).toFixed(2)} ${(PAD.t + PLOT_H).toFixed(2)} Z`
                : "";
        const watchersArea = audience ? closeArea(watchersPath, beforeBreak(watched)) : "";
        const watchersTailArea = audience ? closeArea(watchersTailPath, afterBreak(watched)) : "";

        // Three date labels at most: the ends always, the middle only when the
        // span is wide enough that it is not crowding one of them.
        const xLabels = broken
            ? [points[0], rated[tailStart], points[points.length - 1]]
            : daySpan > 6
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

        return {
            rated,
            dots,
            watched,
            xOf,
            rating,
            yRating,
            audience,
            yWatchers,
            ratingPath,
            ratingTailPath,
            watchersArea,
            watchersTailArea,
            xLabels,
            broken,
            tailDays,
            breakX: PAD.l + activeW,
            stubX: PAD.l + activeW + gapW,
            beforeBreak,
        };
    }, [points]);

    const { rated, dots, xOf, rating, yRating, audience, yWatchers, ratingPath, ratingTailPath, watchersArea, watchersTailArea, xLabels, broken, tailDays, breakX, stubX, beforeBreak } =
        geometry;

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
                        {watchersTailArea && <path d={watchersTailArea} className="fill-sky-500/8" />}
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
                {ratingTailPath && (
                    <path d={ratingTailPath} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-sky-400/60" />
                )}

                {/* The break, marked on the axis rather than across the plot.
                    This was two full-height slashes through the middle of the
                    chart, and the first person to see it asked what the grey
                    bars were — a mark that has to be explained is not marking
                    anything, it is just two more lines in the way. A zigzag
                    sitting on the baseline is the conventional figure and it
                    leaves the data alone; the label above the stub is what
                    actually carries the meaning. */}
                {broken && (
                    <g>
                        <path
                            d={`M ${breakX - 1} ${PAD.t + PLOT_H} l 4 -4 l 3 8 l 3 -8 l 3 8 l 3 -4`}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.25}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-fg-dim"
                        />
                        <text x={(breakX + stubX) / 2 + 4} y={PAD.t - 2} textAnchor="middle" className="fill-fg-dim text-[9px]">
                            {tailDays}d flat
                        </text>
                    </g>
                )}

                {/* A dot where the rating moved, and at both ends. Only the
                    active side gets them: a year of identical readings
                    compressed into a stub would be a smear saying nothing. */}
                {beforeBreak(dots).map((p) => (
                    <circle key={p.day} cx={xOf(p.day)} cy={yRating(p.rating)} r={2.5} className="fill-sky-300" />
                ))}
                {broken && rated.length > 0 && (
                    <circle cx={xOf(rated[rated.length - 1].day)} cy={yRating(rated[rated.length - 1].rating)} r={2.5} className="fill-sky-300/70" />
                )}

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
