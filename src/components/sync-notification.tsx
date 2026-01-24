"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getLastSyncInfo, type SyncInfo } from "@/actions/sync";

const LAST_SEEN_SYNC_KEY = "lastSeenSyncTimestamp";

export function SyncNotification() {
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        if (hasChecked) return;

        const checkSync = async () => {
            try {
                const syncInfo = await getLastSyncInfo();

                if (!syncInfo) {
                    setHasChecked(true);
                    return;
                }

                const lastSeenSync = localStorage.getItem(LAST_SEEN_SYNC_KEY);
                const lastSyncTimestamp = syncInfo.lastSync.getTime();

                // Check if this sync is newer than what the user has seen
                if (!lastSeenSync || parseInt(lastSeenSync) < lastSyncTimestamp) {
                    // Show toast notification
                    const results = syncInfo.results;
                    const successCount = results?.tasks?.filter((t) => t.success).length ?? 0;
                    const totalTasks = results?.tasks?.length ?? 0;

                    const timeAgo = getTimeAgo(syncInfo.lastSync);

                    if (results?.error) {
                        toast.error("Background sync encountered an error", {
                            description: `Sync ran ${timeAgo} but failed: ${results.error}`,
                            duration: 6000,
                        });
                    } else if (totalTasks > 0) {
                        const taskSummary = results?.tasks
                            ?.map((t) => {
                                if (!t.success) return `${formatTaskName(t.task)}: failed`;
                                if (t.task === "mdl-import") {
                                    if (t.matched === 0) return null;
                                    return `${formatTaskName(t.task)}: ${t.matched} matched`;
                                }
                                if (t.count === 0) return null;
                                return `${formatTaskName(t.task)}: ${t.count} updated`;
                            })
                            .filter(Boolean)
                            .join(", ");

                        toast.success("Background sync completed", {
                            description: taskSummary
                                ? `${timeAgo} - ${taskSummary}`
                                : `${timeAgo} - No updates needed`,
                            duration: 5000,
                        });
                    }

                    // Mark this sync as seen
                    localStorage.setItem(LAST_SEEN_SYNC_KEY, lastSyncTimestamp.toString());
                }
            } catch (error) {
                console.error("Failed to check sync status:", error);
            } finally {
                setHasChecked(true);
            }
        };

        // Small delay to let the page render first
        const timeout = setTimeout(checkSync, 1000);
        return () => clearTimeout(timeout);
    }, [hasChecked]);

    return null;
}

function formatTaskName(task: string): string {
    switch (task) {
        case "backfill-backdrops":
            return "Backdrops";
        case "backfill-airing":
            return "Airing status";
        case "mdl-import":
            return "MDL notes";
        default:
            return task;
    }
}

function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "yesterday";
    return `${diffDays} days ago`;
}
