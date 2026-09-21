import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The one header every section of a media page opens with.
 *
 * Each section used to draw its own: an h2 here and an h3 there, "(21)" in
 * parentheses beside one title and a bare "4,325" beside another, "View all →"
 * on the left of Episodes and on the right of everything else, "All reviews ↗"
 * in small grey where the others were link-blue. None of it was wrong on its
 * own; together it read as a page assembled one section at a time, which is
 * what it was. This fixes the grammar: the name and its count on the left, the
 * controls gathered on the right with a toggle ahead of a link, the same
 * measurements everywhere. Usable from server and client.
 */
export function SectionHeader({ title, count, right, className = "mb-4" }: { title: string; count?: number | string | null; right?: ReactNode; className?: string }) {
    return (
        <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${className}`}>
            <div className="flex items-baseline gap-2 min-w-0">
                <h2 className="font-display text-lg font-semibold text-fg">{title}</h2>
                {count != null && count !== "" && (
                    <span className="text-sm tabular-nums text-fg-dim">{typeof count === "number" ? count.toLocaleString("en-US") : count}</span>
                )}
            </div>
            {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
        </div>
    );
}

/** The "View all →" link, so it is the same colour and weight in every header. */
export function SectionLink({ href, children = "View all →" }: { href: string; children?: ReactNode }) {
    return (
        <Link href={href} className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap">
            {children}
        </Link>
    );
}
