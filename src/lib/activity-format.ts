import { ActivityAction } from "@/types/activity";

// Wording and colour for an activity entry. Shared by the history feed and the
// stats heatmap's day panel so the two never describe the same event
// differently. Returns a string with <b> markup, rendered as HTML by callers.
export function formatPayloadText(action: string, payload: unknown, title: string): string {
    const p = payload as Record<string, unknown> | null;
    switch (action) {
        case ActivityAction.ADDED:
            return `Added <b>${title}</b> to watchlist${p?.status ? ` as ${p.status}` : ""}`;
        case ActivityAction.REMOVED:
            return `Removed <b>${title}</b> from watchlist`;
        case ActivityAction.PROGRESS: {
            const to = p?.to as number | undefined;
            const from = p?.from as number | undefined;
            if (to !== undefined && from !== undefined && to - from > 1) {
                return `Watched episodes ${from + 1}–${to} of <b>${title}</b>`;
            }
            return `Watched episode ${to ?? "?"} of <b>${title}</b>`;
        }
        case ActivityAction.STATUS_CHANGED: {
            const from = p?.from as string | undefined;
            const to = p?.to as string | undefined;
            return `Changed <b>${title}</b> from ${from ?? "?"} → ${to ?? "?"}`;
        }
        case ActivityAction.SCORED: {
            const to = p?.to as number | undefined;
            return `Rated <b>${title}</b> ${to ?? "?"}/10`;
        }
        case ActivityAction.NOTED:
            return `Added a note to <b>${title}</b>`;
        default:
            return `Updated <b>${title}</b>`;
    }
}

export const ACTION_COLOR: Record<string, string> = {
    [ActivityAction.ADDED]: "text-blue-400",
    [ActivityAction.REMOVED]: "text-rose-400",
    [ActivityAction.PROGRESS]: "text-violet-400",
    [ActivityAction.STATUS_CHANGED]: "text-amber-400",
    [ActivityAction.SCORED]: "text-yellow-400",
    [ActivityAction.NOTED]: "text-slate-400",
};

export function mediaHref(source: string, externalId: string) {
    return `/media/${source.toLowerCase()}-${externalId}`;
}
