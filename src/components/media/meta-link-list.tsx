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
    className = "text-sm text-fg-muted",
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
                        <span aria-hidden className="text-fg-faint">
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
// full link colour, the same as the Related row above them. Tags qualify it and
// run to a dozen: same hue, dialled down. Same size for both, underline on hover
// only: a size up and an underline at rest made four common words the loudest
// line of the block.
export const GENRE_LIST = {
    className: "text-sm",
    linkClassName: "text-sky-300 hover:text-sky-200 hover:underline hover:underline-offset-4",
};

export const TAG_LIST = {
    className: "text-sm",
    linkClassName: "text-sky-300/65 hover:text-sky-200 hover:underline hover:underline-offset-4",
};
