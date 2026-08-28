"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

export type TrendPoint = { day: string; rating: number };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Formatted from the string parts, never through Date. "2026-08-12" parsed as a
// Date is UTC midnight, and toLocaleDateString west of Greenwich renders that as
// the 11th — a reading filed under the wrong day.
function formatDay(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

const W = 236;
const H = 60;

/**
 * The rating's history, behind a trend icon beside the rating.
 *
 * Nothing lands in the hero line but the icon. That line carries the title's
 * identity — year, country, type, episode count — and a chart wedged into it
 * has no room to say what it is, which is exactly how it reads: an ornament
 * hung off a number. In here the chart gets a header, a scale and a per-day
 * readout, and those are what turn a shape into a statement.
 *
 * Hover peeks, click pins. The pin earns its keep because the panel is
 * interactive: running along the chart to read individual days is impossible if
 * it shuts the moment the pointer leaves the icon.
 */
export function MdlRatingTrendPopover({ points }: { points: TrendPoint[] }) {
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const [hover, setHover] = useState<number | null>(null);
    const wrapRef = useRef<HTMLSpanElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!open) return;
        const shut = () => {
            setOpen(false);
            setPinned(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") shut();
        };
        const onDown = (e: MouseEvent) => {
            if (!wrapRef.current?.contains(e.target as Node)) shut();
        };
        document.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onDown);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onDown);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
        },
        [],
    );

    const show = () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
        setOpen(true);
    };

    // Long enough to cross the gap between the icon and the panel below it.
    const hide = () => {
        if (pinned) return;
        if (closeTimer.current) clearTimeout(closeTimer.current);
        closeTimer.current = setTimeout(() => setOpen(false), 180);
    };

    const values = points.map((p) => p.rating);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo;

    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => (span === 0 ? H / 2 : H - ((v - lo) / span) * H);

    // Stepped, never sloped. A day with no row means nobody looked, not that the
    // value drifted evenly across the gap — a diagonal over three empty weeks
    // draws a movement no one observed.
    let path = `M 0 ${y(values[0]).toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        path += ` L ${x(i).toFixed(2)} ${y(values[i - 1]).toFixed(2)} L ${x(i).toFixed(2)} ${y(values[i]).toFixed(2)}`;
    }

    const delta = values[values.length - 1] - values[0];
    const rounded = Math.round(delta * 100) / 100;
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";

    // The trigger says "movement over time" rather than the generic "more to
    // read" an info glyph says, and it leans whichever way the rating went. The
    // direction costs nothing: the icon has to be some shape regardless, so it
    // may as well be the right one. Still sky, never green or red — those mean
    // watched and dropped everywhere else on the site.
    const TrendIcon = rounded > 0 ? TrendingUp : rounded < 0 ? TrendingDown : Minus;
    const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "unchanged";

    const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        const i = Math.round(ratio * (points.length - 1));
        setHover(Math.max(0, Math.min(points.length - 1, i)));
    };

    const active = hover != null ? points[hover] : null;

    return (
        <span ref={wrapRef} className="relative inline-flex align-middle" onMouseEnter={show} onMouseLeave={hide}>
            <button
                type="button"
                onClick={() => {
                    setPinned((p) => !p);
                    setOpen(true);
                }}
                aria-expanded={open}
                aria-label={`Rating history, ${direction} ${Math.abs(rounded).toFixed(2)} over ${points.length} readings`}
                className="cursor-pointer ml-1 inline-flex items-center text-sky-400/60 transition-colors hover:text-sky-300"
            >
                <TrendIcon className="size-3.5" />
            </button>

            {open && (
                <div
                    className="absolute left-0 top-full z-50 mt-2 w-64 rounded-lg border border-white/10 bg-gray-900 p-3 shadow-xl shadow-black/50"
                    onMouseEnter={show}
                    onMouseLeave={hide}
                >
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[11px] font-medium text-gray-400">MDL rating</span>
                        <span className="text-xs font-semibold tabular-nums text-sky-400">
                            {sign}
                            {Math.abs(rounded).toFixed(2)}
                        </span>
                    </div>

                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{ height: H }}
                        className="mt-2 w-full cursor-crosshair overflow-visible"
                        onPointerMove={onMove}
                        onPointerLeave={() => setHover(null)}
                    >
                        <path
                            d={path}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-sky-400/80"
                        />
                        {active && hover != null && (
                            <g>
                                <line x1={x(hover)} y1={0} x2={x(hover)} y2={H} stroke="currentColor" strokeWidth={1} className="text-white/15" />
                                <circle cx={x(hover)} cy={y(active.rating)} r={2.5} className="fill-sky-300" />
                            </g>
                        )}
                    </svg>

                    {/* The scale, which the chart cannot show on its own: it is
                        normalised to its own range, so a dramatic-looking slope
                        might be six hundredths or a whole point. */}
                    <div className="mt-2 flex items-baseline justify-between gap-2 text-[11px] text-gray-500">
                        <span className="tabular-nums">
                            {active ? (
                                <>
                                    <span className="text-gray-300">{formatDay(active.day)}</span>{" "}
                                    <span className="text-sky-400">{active.rating.toFixed(2)}</span>
                                </>
                            ) : (
                                `${formatDay(points[0].day)} → ${formatDay(points[points.length - 1].day)}`
                            )}
                        </span>
                        <span className="tabular-nums">
                            {lo.toFixed(2)}
                            {"–"}
                            {hi.toFixed(2)}
                        </span>
                    </div>

                    <p className="mt-1.5 text-[10px] leading-snug text-gray-600">
                        {points.length} readings. A missing day is a day nobody looked, not a day it held.
                    </p>
                </div>
            )}
        </span>
    );
}
