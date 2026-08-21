"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { refreshUniverseTop, type UniverseRefreshResult } from "@/actions/mdl-top-refresh";
import type { KuryanaTopCountry } from "@/lib/kuryana";

/**
 * Renders nothing. Once a universe section is on screen, it asks the server
 * to re-scrape its top lists and re-renders only if something actually moved.
 */
function describe(result: UniverseRefreshResult): string | null {
    const parts = (result.changes ?? [])
        .map((c) => `${c.added} new in ${c.label}`);
    return parts.length > 0 ? parts.join(" · ") : null;
}

export function UniverseLiveRefresh({
    title,
    country,
    isoCountry,
    excludeTags,
}: {
    title: string;
    country: KuryanaTopCountry;
    isoCountry: string;
    excludeTags?: string;
}) {
    const router = useRouter();
    // Effects run twice in dev StrictMode, and a re-render from router.refresh()
    // would otherwise start the whole thing again — see MdlLiveRefresh.
    const fired = useRef(false);
    const alive = useRef(true);

    useEffect(() => {
        alive.current = true;
        if (fired.current) return;
        fired.current = true;

        (async () => {
            try {
                const result = await refreshUniverseTop(country, isoCountry, excludeTags);
                if (!result.refreshed || !alive.current) return;

                const summary = describe(result);
                if (summary) {
                    toast(summary, {
                        description: title,
                        icon: <Sparkles className="h-4 w-4 text-sky-400" />,
                    });
                }
                router.refresh();
            } catch {
                // Silent by design: the page is already showing valid cached data
            }
        })();
        return () => {
            alive.current = false;
        };
    }, [title, country, isoCountry, excludeTags, router]);

    return null;
}
