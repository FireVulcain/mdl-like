"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { refreshMdlLiveData } from "@/actions/mdl-live-refresh";

/**
 * Renders nothing. Once the page is on screen, it asks the server to re-read
 * MDL's volatile numbers and re-renders only if one of them moved.
 *
 * The page has already painted from cache by the time this runs, so nothing is
 * ever waiting on it — this is the "show it now, correct it after" half of the
 * pattern, moved off the render path where it used to block.
 */
export function MdlLiveRefresh({ externalId, season }: { externalId: string; season?: number }) {
    const router = useRouter();
    // Effects run twice in dev StrictMode, and a re-render from router.refresh()
    // would otherwise start the whole thing again
    const fired = useRef(false);

    useEffect(() => {
        if (fired.current) return;
        fired.current = true;

        let cancelled = false;
        (async () => {
            try {
                const { refreshed } = await refreshMdlLiveData(externalId, season);
                if (refreshed && !cancelled) router.refresh();
            } catch {
                // Silent by design: the page is already showing valid cached data
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [externalId, season, router]);

    return null;
}
