"use client";

import { useEffect, useState } from "react";

export type MdlLiveField = "rating" | "ranking" | "watchers";

export type MdlLiveDetail = {
    /** Which entry the numbers belong to — see the scope check below. */
    scope: string;
    values: Partial<Record<MdlLiveField, number>>;
};

export const MDL_LIVE_EVENT = "mdl-live-update";

export function announceMdlLive(detail: MdlLiveDetail) {
    window.dispatchEvent(new CustomEvent<MdlLiveDetail>(MDL_LIVE_EVENT, { detail }));
}

function format(value: number, field: MdlLiveField): string {
    if (field === "rating") return value.toFixed(1);
    if (field === "ranking") return `#${value}`;
    return value.toLocaleString("en-US");
}

/**
 * One MDL figure, server-rendered and able to correct itself in place.
 *
 * The live refresh used to call router.refresh() after it found a number had
 * moved, which re-rendered the whole page to change two digits — on a media
 * page that means nineteen Suspense boundaries, the cast, the episode guide,
 * the reviews and the recommendations, all rebuilt. The toast landed at once
 * and the figure it announced followed seconds later.
 *
 * The action already returns the new values, so they are on the client before
 * the toast is drawn. This listens for them instead, and nothing else on the
 * page is touched.
 *
 * The scope is what keeps a season's number from surviving onto another's:
 * switching seasons is a navigation within the same route, so React may keep
 * this mounted with new props. Comparing the scope the value arrived with
 * against the one currently rendered makes a stale figure fall back to the
 * server's, without an effect to reset it.
 */
export function MdlLiveValue({
    field,
    initial,
    scope,
}: {
    field: MdlLiveField;
    initial: number;
    scope: string;
}) {
    const [live, setLive] = useState<{ scope: string; value: number } | null>(null);

    useEffect(() => {
        const onUpdate = (event: Event) => {
            const detail = (event as CustomEvent<MdlLiveDetail>).detail;
            const next = detail?.values?.[field];
            if (typeof next === "number") setLive({ scope: detail.scope, value: next });
        };
        window.addEventListener(MDL_LIVE_EVENT, onUpdate);
        return () => window.removeEventListener(MDL_LIVE_EVENT, onUpdate);
    }, [field]);

    const value = live && live.scope === scope ? live.value : initial;
    return <>{format(value, field)}</>;
}
