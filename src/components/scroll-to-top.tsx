"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A new page opens at its top.
 *
 * Next is meant to do this itself, and gives up: after a navigation it looks
 * for the first DOM node of the segment that changed and scrolls only when
 * that node's top is off screen — but React 19 hoists a page's <title> and
 * <meta> into <head>, so on every page with metadata (nineteen here) the
 * first node it finds is a zero-sized tag among other zero-sized tags, and
 * it walks off the end of <head> and does nothing. Its own source marks this
 * as "always a bug in Next.js". The old scroll position stayed, which on a
 * tall page reached from deep in a long one meant landing in the middle.
 *
 * So this does the one thing, on the one occasion: when the pathname
 * changes. Not on the first load (the browser restores a reload's position
 * and honours a hash), not on back and forward (the browser restores those
 * too — a popstate is noted and let through), not on a hash link (Next
 * scrolls to the element itself, in the layout phase, and this must not
 * undo it), and not on a query-only change (?season=2 keeps the reader where
 * they are). Before paint, so the top is what the eye sees first.
 *
 * The query is watched as well as the path, without scrolling for it: a
 * back over ?season= is a popstate that changes nothing else, and the note
 * it leaves has to be cleared by the render it causes, or the next real
 * navigation would be let through as if it were a back.
 */
export function ScrollToTop() {
    const pathname = usePathname();
    const search = useSearchParams().toString();
    const previous = useRef(pathname);
    const restoring = useRef(false);

    useEffect(() => {
        // Fires before the router applies the entry, so the layout effect
        // below sees the note on the navigation the browser is restoring.
        const onPop = () => {
            restoring.current = true;
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);

    useLayoutEffect(() => {
        const moved = pathname !== previous.current;
        previous.current = pathname;
        const back = restoring.current;
        restoring.current = false;
        if (!moved || back || window.location.hash) return;
        window.scrollTo(0, 0);
    }, [pathname, search]);

    return null;
}
