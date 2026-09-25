"use client";

import { Fragment, useEffect, useRef, useState } from "react";

export interface NavSection {
    id: string;
    label: string;
}

/**
 * The header shrinks once the page has scrolled: 8px of padding and a 56px
 * pill. The strip sticks flush under the pill, so nothing scrolls through the
 * seam between the two, and takes its breath as padding of its own.
 */
const STICKY_TOP = 64;
/** A section is "current" once its top has passed this line. */
const ACTIVE_LINE = STICKY_TOP + 64;

/**
 * The jump strip under the title.
 *
 * It used to scroll away with the hero, which on a page thirteen thousand
 * pixels tall left the reader with no way back to Photos except the scrollbar.
 * It sticks now, under the header, and marks the section on screen — the same
 * strip serves as the table of contents and the "you are here".
 *
 * Groups draw with a hairline between them, so the strip divides where the
 * page does. `sections` is the flat form the people page still passes.
 */
export function MediaNav({ sections, groups }: { sections?: NavSection[]; groups?: NavSection[][] }) {
    const resolved = groups ?? (sections ? [sections] : []);
    const flat = resolved.flat();
    const ids = flat.map((s) => s.id).join("|");
    const [active, setActive] = useState<string | null>(null);
    // Entries whose section resolved to nothing. Most sections stream in and
    // may come back empty — no reviews, no chart yet — and a jump to a section
    // that is not there is a jump to nowhere. Unknown until the client runs,
    // so the server draws every entry and the empties fall away on arrival.
    const [absent, setAbsent] = useState<Set<string>>(() => new Set());
    // Whether the strip is pinned under the header. Only then does it need a
    // ground of its own, to hide what scrolls beneath; at rest it sits on the
    // page's backdrop, and a solid strip there read as a black band.
    const navRef = useRef<HTMLElement>(null);
    const [stuck, setStuck] = useState(false);

    // Spy on scroll, not with an observer: the question is "which section's
    // top is the last one above the line", and that is one pass over a dozen
    // rects, once per frame at most. The body's ResizeObserver covers what
    // scrolling does not — a section streaming in, or "Show all" opening one.
    useEffect(() => {
        const targets = ids.split("|").filter(Boolean);
        if (targets.length < 2) return;
        let raf = 0;
        const update = () => {
            raf = 0;
            const nav = navRef.current;
            if (nav) setStuck(nav.getBoundingClientRect().top <= STICKY_TOP + 1);
            let current: string | null = null;
            const gone = new Set<string>();
            for (const id of targets) {
                const el = document.getElementById(id);
                // An empty section is display:none, and so has no offsetParent.
                if (!el || el.offsetParent === null) {
                    gone.add(id);
                    continue;
                }
                if (el.getBoundingClientRect().top <= ACTIVE_LINE) current = id;
                else break;
            }
            setActive(current);
            setAbsent((prev) => (prev.size === gone.size && [...gone].every((id) => prev.has(id)) ? prev : gone));
        };
        const schedule = () => {
            if (!raf) raf = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        const ro = new ResizeObserver(schedule);
        ro.observe(document.body);
        return () => {
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            ro.disconnect();
            if (raf) cancelAnimationFrame(raf);
        };
    }, [ids]);

    if (flat.length < 2) return null;

    function handleClick(id: string) {
        const el = document.getElementById(id);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY - ACTIVE_LINE + 8;
        window.scrollTo({ top, behavior: "smooth" });
    }

    return (
        // Transparent at rest, so the page's backdrop shows through as it does
        // everywhere else. Pinned, it takes the page colour, opaque and with no
        // blur: a blurred strip would be one more layer composited on every
        // scroll frame. The negative margin lets the strip cover the content's
        // full width while the items keep their left edge.
        <nav ref={navRef} className={`sticky z-20 -mx-2 px-2 pt-3 transition-colors ${stuck ? "bg-app" : "bg-transparent"}`} style={{ top: STICKY_TOP }} aria-label="Sections">
            <div className="flex items-center gap-5 overflow-x-auto scrollbar-hide border-b border-line">
                {resolved
                    .map((group) => group.filter(({ id }) => !absent.has(id)))
                    .filter((group) => group.length > 0)
                    .map((group, g) => (
                        <Fragment key={g}>
                            {g > 0 && <span aria-hidden className="mb-2.5 h-3.5 w-px shrink-0 bg-line-strong" />}
                            {group.map(({ id, label }) => {
                                const isActive = active === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleClick(id)}
                                        aria-current={isActive ? "location" : undefined}
                                        className={`relative shrink-0 pb-2.5 text-sm font-medium whitespace-nowrap cursor-pointer transition-colors ${
                                            isActive ? "text-fg" : "text-fg-muted hover:text-fg"
                                        }`}
                                    >
                                        {label}
                                        {/* The marker sits on the rule, the way a tab's does. */}
                                        <span
                                            aria-hidden
                                            className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-sky-400 transition-opacity ${
                                                isActive ? "opacity-100" : "opacity-0"
                                            }`}
                                        />
                                    </button>
                                );
                            })}
                        </Fragment>
                    ))}
            </div>
        </nav>
    );
}
