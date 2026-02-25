"use server";

import { prisma } from "@/lib/prisma";
import { ActivityAction } from "@/types/activity";
import { Prisma } from "@prisma/client";

const PAGE_SIZE = 30;

export async function getActivityLog(userId: string, cursor?: string, filterActions?: string[]) {
    const where: Prisma.ActivityLogWhereInput = { userId };
    if (filterActions && filterActions.length > 0) {
        where.action = { in: filterActions };
    }

    const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = logs.length > PAGE_SIZE;
    const items = hasMore ? logs.slice(0, PAGE_SIZE) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor };
}

export async function deleteActivityLog(id: string) {
    await prisma.activityLog.delete({ where: { id } });
}

export async function backfillActivityLog(userId: string) {
    // Delete existing backfill rows for this user (idempotent)
    await prisma.activityLog.deleteMany({
        where: { userId, isBackfill: true },
    });

    const userMediaItems = await prisma.userMedia.findMany({ where: { userId } });

    const logs: Prisma.ActivityLogCreateManyInput[] = [];

    for (const item of userMediaItems) {
        // lastWatchedAt is set only by user actions (progress/status changes) — never touched by
        // background sync jobs. updatedAt (@updatedAt) gets clobbered on every sync run, making
        // it unreliable. Skip items with no lastWatchedAt since we have no trustworthy timestamp.
        const timestamp = item.lastWatchedAt;
        if (!timestamp) continue;

        const base = {
            userId,
            userMediaId: item.id,
            externalId: item.externalId,
            source: item.source,
            mediaType: item.mediaType,
            title: item.title ?? "",
            poster: item.poster ?? null,
            isBackfill: true,
        };

        // ADDED event
        logs.push({
            ...base,
            action: ActivityAction.ADDED,
            createdAt: timestamp,
            payload: { status: item.status, season: item.season } as Prisma.InputJsonValue,
        });

        // Progress event if progress > 0
        if (item.progress > 0) {
            logs.push({
                ...base,
                action: ActivityAction.PROGRESS,
                createdAt: timestamp,
                payload: { from: 0, to: item.progress } as Prisma.InputJsonValue,
            });
        }

        // Score event if rated (skip 0 — means unrated, not an actual score)
        if (item.score !== null && item.score > 0) {
            logs.push({
                ...base,
                action: ActivityAction.SCORED,
                createdAt: timestamp,
                payload: { from: null, to: item.score } as Prisma.InputJsonValue,
            });
        }

        // Notes event if notes exist
        if (item.notes && item.notes.trim()) {
            logs.push({
                ...base,
                action: ActivityAction.NOTED,
                createdAt: timestamp,
            });
        }

        // Status_changed event for terminal statuses
        if (item.status === "Completed" || item.status === "Dropped") {
            logs.push({
                ...base,
                action: ActivityAction.STATUS_CHANGED,
                createdAt: timestamp,
                payload: { from: "Watching", to: item.status } as Prisma.InputJsonValue,
            });
        }
    }

    await prisma.activityLog.createMany({ data: logs });

    return { success: true, count: logs.length };
}
