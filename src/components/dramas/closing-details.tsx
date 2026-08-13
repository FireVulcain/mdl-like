"use client";

import { useRef } from "react";

/**
 * A <details> dropdown that closes when something inside it is chosen.
 *
 * `open` is a DOM property the browser owns, not React state, and a soft
 * navigation reuses the same element — so picking a year re-rendered the page
 * underneath a menu that stayed exactly where it was.
 *
 * Only clicks that land on a link count. Clicks on the summary are the browser's
 * own toggle and must be left alone, which is also why the accordions on this
 * page — the ones that expand in place and are open by default — keep using a
 * plain <details>.
 *
 * `name` makes a set of them mutually exclusive: opening one closes its
 * siblings, which is the platform's own accordion behaviour and needs no state
 * of ours. A browser that does not know the attribute ignores it and simply
 * lets both stay open, which is where this started.
 */
export function ClosingDetails({
    className,
    name,
    children,
}: {
    className?: string;
    name?: string;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDetailsElement>(null);

    return (
        <details
            ref={ref}
            className={className}
            name={name}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open");
            }}
        >
            {children}
        </details>
    );
}
