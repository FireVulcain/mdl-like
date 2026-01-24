"use server";

import { prisma } from "@/lib/prisma";

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
} | null;

export async function getLastSyncInfo(): Promise<SyncInfo> {
    try {
        const syncLog = await prisma.syncLog.findUnique({
            where: { id: "daily-sync" },
        });

        if (!syncLog) {
            return null;
        }

        return {
            lastSync: syncLog.lastSync,
            results: syncLog.results as SyncResults | null,
        };
    } catch (error) {
        console.error("Failed to get sync info:", error);
        return null;
    }
}
