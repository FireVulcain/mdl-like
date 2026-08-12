"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { refreshMdlLiveData, type MdlLiveRefreshResult } from "@/actions/mdl-live-refresh";

/**
 * Renders nothing. Once the page is on screen, it asks the server to re-read
 * MDL's volatile numbers and re-renders only if one of them moved.
 *
 * The page has already painted from cache by the time this runs, so nothing is
 * ever waiting on it — this is the "show it now, correct it after" half of the
 * pattern, moved off the render path where it used to block.
 *
 * When something does move, it says so. The correction lands seconds after the
 * page settles and changes a number nobody is staring at, so without a toast the
 * only way to catch it is to watch the rating and hope.
 */
function describe(result: MdlLiveRefreshResult): string | null {
    const parts: string[] = [];

    if (result.rating?.to != null) {
        const from = result.rating.from;
        parts.push(from != null ? `Rating ${from.toFixed(1)} → ${result.rating.to.toFixed(1)}` : `Rating ${result.rating.to.toFixed(1)}`);
    }

    if (result.ranking?.to != null) {
        const from = result.ranking.from;
        parts.push(from != null ? `Rank #${from} → #${result.ranking.to}` : `Rank #${result.ranking.to}`);
    }

    if (result.watchers?.to != null) {
        const from = result.watchers.from;
        const delta = from != null ? result.watchers.to - from : null;
        // The delta is the interesting half — "+58" says more about a show than
        // the running total does.
        parts.push(
            delta != null && delta !== 0
                ? `${delta > 0 ? "+" : ""}${delta.toLocaleString("en-US")} watchers`
                : `${result.watchers.to.toLocaleString("en-US")} watchers`,
        );
    }

    return parts.length > 0 ? parts.join(" · ") : null;
}

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
                const result = await refreshMdlLiveData(externalId, season);
                if (!result.refreshed || cancelled) return;

                const summary = describe(result);
                if (summary) {
                    toast(summary, {
                        description: "Updated from MyDramaList",
                        icon: <TrendingUp className="h-4 w-4 text-sky-400" />,
                    });
                }
                router.refresh();
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
