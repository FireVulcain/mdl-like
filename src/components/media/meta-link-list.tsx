import React from "react";
import Link from "next/link";

export type MetaItem = { key: string; label: string; href?: string };

/**
 * A run of genres or tags, written as a sentence rather than drawn as chips.
 *
 * These used to be pills — fill, border and a full radius around one or two
 * words, fifteen of them in a row on a single show. A word doesn't need a
 * container, and the heading above already says what the run is.
 *
 * But they are navigation, not metadata, and the first attempt at removing the
 * boxes removed the signal with them: grey text that happens to be clickable
 * reads as inert. The affordance moves to colour, which is the oldest and
 * plainest link marker there is, and the caller sets how loud it should be.
 */
export function MetaLinkList({
    items,
    className = "text-sm text-white/60",
    linkClassName = "text-sky-300 hover:text-sky-200",
}: {
    items: MetaItem[];
    className?: string;
    linkClassName?: string;
}) {
    if (items.length === 0) return null;
    return (
        <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 ${className}`}>
            {items.map((item, i) => (
                <React.Fragment key={item.key}>
                    {i > 0 && (
                        <span aria-hidden className="text-white/20">
                            ·
                        </span>
                    )}
                    {item.href ? (
                        <Link href={item.href} className={`transition-colors ${linkClassName}`}>
                            {item.label}
                        </Link>
                    ) : (
                        <span>{item.label}</span>
                    )}
                </React.Fragment>
            ))}
        </p>
    );
}

// Genres classify the show and there are only ever a handful, so they carry the
// full link colour, a size up, and an underline at rest. Tags qualify it and run
// to a dozen: same hue, dialled down, with the underline held back for hover —
// twelve underlined items in a row reads as a link farm.
export const GENRE_LIST = {
    className: "text-base",
    linkClassName:
        "font-medium text-sky-300 underline decoration-sky-400/30 underline-offset-4 hover:text-sky-200 hover:decoration-sky-300",
};

export const TAG_LIST = {
    className: "text-sm",
    linkClassName: "text-sky-300/65 hover:text-sky-200 hover:underline hover:underline-offset-4",
};
