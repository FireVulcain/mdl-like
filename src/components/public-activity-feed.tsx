"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ActivityAction } from "@/types/activity";

// Each entry is a sentence with the title in bold. A coloured icon per action
// used to say what the sentence already says, in six different colours.
function formatActivity(action: string, payload: unknown, title: ReactNode): ReactNode {
    const p = payload as Record<string, unknown> | null;
    switch (action) {
        case ActivityAction.ADDED:
            return <>Added {title} to {p?.status ? String(p.status) : "watchlist"}</>;
        case ActivityAction.REMOVED:
            return <>Removed {title} from watchlist</>;
        case ActivityAction.PROGRESS: {
            const to = p?.to as number | undefined;
            const from = p?.from as number | undefined;
            if (to !== undefined && from !== undefined && to - from > 1)
                return <>Watched episodes {from + 1}–{to} of {title}</>;
            return <>Watched episode {to ?? "?"} of {title}</>;
        }
        case ActivityAction.STATUS_CHANGED: {
            const from = p?.from as string | undefined;
            const to = p?.to as string | undefined;
            return <>Moved {title} from {from ?? "?"} to {to ?? "?"}</>;
        }
        case ActivityAction.SCORED: {
            const to = p?.to as number | undefined;
            return <>Rated {title} {to ?? "?"}/10</>;
        }
        case ActivityAction.NOTED:
            return <>Added a note to {title}</>;
        default:
            return title;
    }
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
}

type ActivityEntry = {
    id: string;
    externalId: string;
    source: string;
    mediaType: string;
    title: string;
    poster: string | null;
    action: string;
    payload: unknown;
    createdAt: Date;
};

const INITIAL_COUNT = 5;

export function PublicActivityFeed({ items }: { items: ActivityEntry[] }) {
    const [showAll, setShowAll] = useState(false);
    const visible = showAll ? items : items.slice(0, INITIAL_COUNT);

    return (
        <div>
            <div className="divide-y divide-line-soft">
                {visible.map((entry) => {
                    const mediaHref = `/media/${entry.source.toLowerCase()}-${entry.externalId}`;
                    return (
                        <div key={entry.id} className="flex items-center gap-3 py-2">
                            {entry.poster ? (
                                <Link href={mediaHref} className="shrink-0">
                                    <div className="relative h-9.5 w-6.5 rounded overflow-hidden bg-surface-3">
                                        <Image unoptimized={true} src={entry.poster} alt={entry.title} fill className="object-cover" sizes="26px" />
                                    </div>
                                </Link>
                            ) : (
                                <div className="h-9.5 w-6.5 shrink-0 rounded bg-surface-2" />
                            )}
                            <p className="flex-1 min-w-0 truncate text-sm text-fg-soft">
                                {formatActivity(
                                    entry.action,
                                    entry.payload,
                                    <Link href={mediaHref} className="font-medium text-fg hover:underline underline-offset-2">
                                        {entry.title}
                                    </Link>,
                                )}
                            </p>
                            <span className="shrink-0 text-[13px] text-fg-dim">{timeAgo(entry.createdAt)}</span>
                        </div>
                    );
                })}
            </div>

            {items.length > INITIAL_COUNT && (
                <button
                    onClick={() => setShowAll((v) => !v)}
                    className="pt-2 text-[13px] text-fg-dim hover:text-fg transition-colors cursor-pointer"
                >
                    {showAll ? "Show less" : `Show ${items.length - INITIAL_COUNT} more`}
                </button>
            )}
        </div>
    );
}
