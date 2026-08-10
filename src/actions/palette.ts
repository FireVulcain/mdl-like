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
    /** null for a title that has never been watched — those are index-only. */
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
            lastWatchedAt: true,
        },
        // Postgres sorts NULLs first on DESC, and 166 of these 267 rows have
        // never been touched — without `nulls: "last"` the palette's "recently
        // watched" list was in fact the never-watched ones, in arbitrary order.
        orderBy: { lastWatchedAt: { sort: "desc", nulls: "last" } },
    });

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
            watchedAt: item.lastWatchedAt?.toISOString() ?? null,
            status: item.status,
            progress: item.progress,
            totalEp: item.totalEp,
            year: item.year,
        }));
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

