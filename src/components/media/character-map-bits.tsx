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
