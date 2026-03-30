"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

type TaskResult = {
    task: string;
    success: boolean;
    count?: number;
    matched?: number;
    scraped?: number;
    error?: string;
    duration?: number;
};

type SyncResults = {
    tasks: TaskResult[];
    totalDuration?: number;
    error?: string;
    timestamp: string;
};

export type SyncInfo = {
    lastSync: Date;
    results: SyncResults | null;
    seen: boolean;
} | null;

export async function getLastSyncInfo(): Promise<SyncInfo> {
    try {
        const [syncLog, userId] = await Promise.all([
            prisma.syncLog.findUnique({ where: { id: "daily-sync" } }),
            getCurrentUserId().catch(() => null),
        ]);

        if (!syncLog) return null;

        let seen = false;
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { lastSeenSync: true },
            });
            seen = user?.lastSeenSync != null && user.lastSeenSync >= syncLog.lastSync;
        }

        return {
            lastSync: syncLog.lastSync,
            results: syncLog.results as SyncResults | null,
            seen,
        };
    } catch (error) {
        console.error("Failed to get sync info:", error);
        return null;
    }
}

export async function markSyncAsSeen(): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.user.update({
            where: { id: userId },
            data: { lastSeenSync: new Date() },
        });
    } catch {
        // non-critical
    }
}
