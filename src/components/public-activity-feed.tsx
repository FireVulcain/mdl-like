"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ActivityAction } from "@/types/activity";
import { Star, Play, Plus, Trash2, RefreshCw, FileText } from "lucide-react";

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string }> = {
    [ActivityAction.ADDED]: { icon: Plus, color: "text-blue-400" },
    [ActivityAction.REMOVED]: { icon: Trash2, color: "text-rose-400" },
    [ActivityAction.PROGRESS]: { icon: Play, color: "text-violet-400" },
    [ActivityAction.STATUS_CHANGED]: { icon: RefreshCw, color: "text-amber-400" },
    [ActivityAction.SCORED]: { icon: Star, color: "text-yellow-400" },
    [ActivityAction.NOTED]: { icon: FileText, color: "text-slate-400" },
};

function formatActivity(action: string, payload: unknown, title: string): string {
    const p = payload as Record<string, unknown> | null;
    switch (action) {
        case ActivityAction.ADDED:
            return `Added ${title} to watchlist${p?.status ? ` as ${p.status}` : ""}`;
        case ActivityAction.REMOVED:
            return `Removed ${title} from watchlist`;
        case ActivityAction.PROGRESS: {
            const to = p?.to as number | undefined;
            const from = p?.from as number | undefined;
            if (to !== undefined && from !== undefined && to - from > 1)
                return `Watched episodes ${from + 1}–${to} of ${title}`;
            return `Watched episode ${to ?? "?"} of ${title}`;
        }
        case ActivityAction.STATUS_CHANGED: {
            const from = p?.from as string | undefined;
            const to = p?.to as string | undefined;
            return `Changed ${title} from ${from ?? "?"} → ${to ?? "?"}`;
        }
        case ActivityAction.SCORED: {
            const to = p?.to as number | undefined;
            return `Rated ${title} ${to ?? "?"}/10`;
        }
        case ActivityAction.NOTED:
            return `Added note to ${title}`;
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
        <div className="space-y-1.5">
            {visible.map((entry) => {
                const config = ACTION_CONFIG[entry.action];
                const Icon = config?.icon ?? Play;
                const mediaHref = `/media/${entry.source.toLowerCase()}-${entry.externalId}`;
                return (
                    <div
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors"
                    >
                        {entry.poster ? (
                            <Link href={mediaHref} className="shrink-0">
                                <div className="relative h-8 w-14 rounded overflow-hidden">
                                    <Image unoptimized={true} src={entry.poster} alt={entry.title} fill className="object-cover" sizes="56px" />
                                </div>
                            </Link>
                        ) : (
                            <div className="h-8 w-14 shrink-0 rounded bg-white/5" />
                        )}
                        <div className={`shrink-0 ${config?.color ?? "text-gray-400"}`}>
                            <Icon className="h-4 w-4" />
                        </div>
                        <p className="flex-1 text-sm text-gray-300 min-w-0 truncate">
                            {formatActivity(entry.action, entry.payload, entry.title)}
                        </p>
                        <span className="shrink-0 text-xs text-gray-500">{timeAgo(entry.createdAt)}</span>
                    </div>
                );
            })}

            {items.length > INITIAL_COUNT && (
                <button
                    onClick={() => setShowAll((v) => !v)}
                    className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                    {showAll ? "Show less" : `Show ${items.length - INITIAL_COUNT} more`}
                </button>
            )}
        </div>
    );
}
