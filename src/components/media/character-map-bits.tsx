"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { portrait, PORTRAIT_R, TYPE_CLASS, TYPE_GLYPH, TYPE_LABEL, type LinkType } from "@/lib/character-map";

/**
 * The small pieces the chart and the editor under it both draw: a face, the
 * filter chrome, and the mark for a kind of tie. One copy, so the editor and
 * the picture it writes into never drift apart.
 */

export type FaceOf = { image: string | null; still?: string | null; name: string; inCast: boolean } | null;

const FACE_PX = { sm: 32, md: 44, lg: 2 * PORTRAIT_R } as const;

/**
 * A portrait, at one of three sizes: inside a line of text, in a list row, or
 * at the size the chart draws it. A dashed ring marks someone MDL's cast does
 * not carry, the way the chart does.
 */
export function Face({ person, size = "sm" }: { person: FaceOf; size?: keyof typeof FACE_PX }) {
    if (!person) return null;
    const px = FACE_PX[size];
    const src = portrait(person);
    return (
        <span
            className={`relative shrink-0 overflow-hidden rounded-full bg-surface-2 ${person.inCast ? "" : "border border-dashed border-fg-dim"}`}
            style={{ width: px, height: px }}
        >
            {src ? (
                <Image unoptimized src={src} alt="" fill sizes={`${px}px`} className="object-cover" />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                    <User style={{ width: px * 0.42, height: px * 0.42 }} />
                </span>
            )}
        </span>
    );
}

/**
 * The filter chrome the search page and the chart share: a flat fill, and a
 * ring only on the one that is on.
 */
export const pill = (on: boolean, tone = "") =>
    `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
        on ? `bg-surface-4 text-fg ring-1 ring-line-strong ${tone}` : "bg-surface-2 text-fg-dim hover:bg-surface-3 hover:text-fg"
    }`;

/** A kind of tie, in its colour: the glyph, and the word unless the room is tight. */
export function TypeMark({ type, words = true, className = "" }: { type: LinkType; words?: boolean; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 ${TYPE_CLASS[type]} ${className}`}>
            <span aria-hidden className="text-[13px] leading-none">
                {TYPE_GLYPH[type]}
            </span>
            {words && <span className="text-xs font-semibold uppercase tracking-wide">{TYPE_LABEL[type]}</span>}
        </span>
    );
}

/**
 * The rest of the legend: the line styles, which are switches too. A
 * reveal's line is dashed and an inferred one dotted, so each is keyed by a
 * stroke drawn that way — the legend then explains what a dashed line means
 * as well as hiding it. Labels, keyed by a small chip, read the same way.
 * On and off as the types: the key dims and the word is struck through.
 */
export function LegendToggle({ on, onChange, mark, children }: { on: boolean; onChange: () => void; mark: "dash" | "dot" | "chip"; children: React.ReactNode }) {
    return (
        <button type="button" aria-pressed={on} onClick={onChange} className={`group inline-flex h-7 cursor-pointer items-center gap-2 text-[12.5px] font-medium transition-colors ${on ? "text-fg-soft" : "text-fg-faint"}`}>
            <svg aria-hidden width={18} height={10} className={`text-fg-muted transition-opacity ${on ? "" : "opacity-30"}`}>
                {mark === "chip" ? (
                    <rect x={1} y={1.5} width={16} height={7} rx={2.5} fill="currentColor" fillOpacity={0.35} />
                ) : (
                    <line x1={1.25} y1={5} x2={16.75} y2={5} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray={mark === "dash" ? "4 3.5" : "0.1 3.8"} />
                )}
            </svg>
            <span className={`group-hover:text-fg ${on ? "" : "line-through decoration-fg-faint"}`}>{children}</span>
        </button>
    );
}

/**
 * A kind of tie as an entry of the legend, which is also its filter: a
 * stroke in the colour and weight of its lines, the name, the count. Off,
 * the stroke dims and the name is struck through. The chart and the list
 * under it both filter with it, so the two read as one page.
 */
export function LegendType({ type, on, count, onChange }: { type: LinkType; on: boolean; count: number; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            aria-pressed={on}
            disabled={count === 0}
            className={`group inline-flex h-7 cursor-pointer items-center gap-2 text-[12.5px] font-medium transition-colors disabled:cursor-default disabled:opacity-40 ${on ? "text-fg-soft" : "text-fg-faint"}`}
        >
            <span className={`h-[2.5px] w-[18px] rounded-full bg-current transition-opacity ${TYPE_CLASS[type]} ${on ? "" : "opacity-25"}`} />
            <span className={`group-hover:text-fg ${on ? "" : "line-through decoration-fg-faint"}`}>{TYPE_LABEL[type]}</span>
            <span className="text-[11.5px] tabular-nums text-fg-dim">{count}</span>
        </button>
    );
}

/**
 * One tie's mark in a line of text, drawn as the chart draws its line: a
 * stroke in the type's colour, dashed for a reveal, dotted for an inferred
 * tie; a moment, which the chart never draws as a line, is a small ring.
 */
export function TieMark({ type, reveal, inferred, moment }: { type: LinkType; reveal?: boolean; inferred?: boolean; moment?: boolean }) {
    if (moment) {
        return (
            <span aria-hidden className={`flex h-2.5 w-3.5 shrink-0 items-center justify-center ${TYPE_CLASS[type]}`}>
                <span className="h-2 w-2 rounded-full border-[1.5px] border-current" />
            </span>
        );
    }
    const style: React.CSSProperties = reveal
        ? { background: "repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 8px)" }
        : inferred
          ? { background: "radial-gradient(circle, currentColor 1.3px, transparent 1.6px) 0 50% / 4.5px 3px repeat-x", height: 3 }
          : { background: "currentColor" };
    return <span aria-hidden className={`h-[2.5px] w-3.5 shrink-0 rounded-full ${TYPE_CLASS[type]}`} style={style} />;
}
