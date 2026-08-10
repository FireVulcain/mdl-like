"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { ActivityAction } from "@/types/activity";
import { updateUserMedia } from "@/actions/media";

export type PaletteItem = {
    id: string;
    title: string;
    poster: string | null;
    href: string;
    season: number;
    /** Last episode actually watched; null means index-only, never watched. */
    watchedAt: string | null;
    status: string;
    progress: number;
    totalEp: number | null;
    year: number | null;
};

/**
 * The palette's local index.
 *
 * Deliberately not `getWatchlist()`: that one joins cached MDL rows and season
 * links to build the full table, which is far more than a list of names needs.
 * This is one indexed query over columns the palette actually shows, fetched
 * once on first open and then held in memory for the rest of the session.
 */
export async function getPaletteWatchlist(): Promise<PaletteItem[]> {
    const userId = await getCurrentUserId();

    const items = await prisma.userMedia.findMany({
        where: { userId },
        select: {
            id: true,
            title: true,
            poster: true,
            source: true,
            externalId: true,
            season: true,
            status: true,
            progress: true,
            totalEp: true,
            year: true,
        },
    });

    // Not `lastWatchedAt`: updateUserMedia bumps that on any status change, so
    // dropping a show or moving it to Plan to Watch would file it under
    // "recently watched". Progress events are the only record of actually
    // watching something. Within a 30-minute session upsertProgressLog merges
    // into the existing row, so this is the start of the session rather than
    // the last click — which is the more useful of the two anyway.
    const watched = await prisma.activityLog.groupBy({
        by: ["userMediaId"],
        where: { userId, action: ActivityAction.PROGRESS, userMediaId: { not: null } },
        _max: { createdAt: true },
    });
    const watchedAt = new Map(watched.map((row) => [row.userMediaId, row._max.createdAt]));

    return items
        .filter((item) => item.title)
        .map((item) => ({
            id: item.id,
            title: item.title!,
            poster: item.poster,
            // Seasons are separate rows with separate pages, exactly as the
            // watchlist links them — two entries for one show are not duplicates.
            href: `/media/${item.source.toLowerCase()}-${item.externalId}${item.season > 1 ? `?season=${item.season}` : ""}`,
            season: item.season,
            watchedAt: watchedAt.get(item.id)?.toISOString() ?? null,
            status: item.status,
            progress: item.progress,
            totalEp: item.totalEp,
            year: item.year,
        }))
        // Most recently watched first, never-watched last. Sorting here rather
        // than in SQL because the timestamp comes from the second query.
        .sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""));
}

/**
 * Step the last progress change back to where it was.
 *
 * The activity log already stores `{ from, to }` on every progress event, so
 * the previous value is a fact rather than a guess — no separate undo stack.
 * Only the most recent event is reversible, and only if it still matches the
 * item's current progress; anything else means something changed since, and
 * silently rewinding it would be worse than refusing.
 */
export async function undoLastProgress(): Promise<{ ok: boolean; message: string }> {
    const userId = await getCurrentUserId();

    const log = await prisma.activityLog.findFirst({
        where: { userId, action: ActivityAction.PROGRESS, userMediaId: { not: null }, isBackfill: false },
        orderBy: { createdAt: "desc" },
    });
    if (!log?.userMediaId) return { ok: false, message: "Nothing to undo" };

    const payload = log.payload as { from?: unknown; to?: unknown } | null;
    const from = typeof payload?.from === "number" ? payload.from : null;
    const to = typeof payload?.to === "number" ? payload.to : null;
    if (from === null || to === null) return { ok: false, message: "Nothing to undo" };

    const item = await prisma.userMedia.findFirst({ where: { id: log.userMediaId, userId } });
    if (!item) return { ok: false, message: "Nothing to undo" };
    if (item.progress !== to) {
        return { ok: false, message: `${item.title ?? "That title"} has changed since — undo skipped` };
    }

    await updateUserMedia(item.id, { progress: from });
    return { ok: true, message: `${item.title ?? "Progress"} back to episode ${from}` };
}

