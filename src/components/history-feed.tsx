"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getActivityLog, deleteActivityLog, backfillActivityLog } from "@/actions/history";
import { ActivityAction } from "@/types/activity";
import { Plus, Trash2, Play, RefreshCw, Star, FileText, Clock, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// All filterable action types with their display config
const FILTER_OPTIONS = [
    { action: ActivityAction.PROGRESS, label: "Watched", color: "text-violet-400", activeClass: "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" },
    { action: ActivityAction.ADDED, label: "Added", color: "text-blue-400", activeClass: "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30" },
    { action: ActivityAction.SCORED, label: "Rated", color: "text-yellow-400", activeClass: "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30" },
    { action: ActivityAction.STATUS_CHANGED, label: "Status", color: "text-amber-400", activeClass: "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30" },
    { action: ActivityAction.NOTED, label: "Noted", color: "text-slate-400", activeClass: "bg-slate-500/20 text-slate-400 ring-1 ring-slate-500/30" },
    { action: ActivityAction.REMOVED, label: "Removed", color: "text-rose-400", activeClass: "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30" },
];

type ActivityLogItem = {
    id: string;
    userId: string;
    userMediaId: string | null;
    externalId: string;
    source: string;
    mediaType: string;
    title: string;
    poster: string | null;
    action: string;
    payload: unknown;
    createdAt: Date;
    isBackfill: boolean;
};

type Props = {
    initialItems: ActivityLogItem[];
    initialNextCursor: string | null;
    userId: string;
};

const ACTION_CONFIG: Record<
    string,
    { icon: React.ElementType; color: string; label: string }
> = {
    [ActivityAction.ADDED]: { icon: Plus, color: "text-blue-400", label: "Added" },
    [ActivityAction.REMOVED]: { icon: Trash2, color: "text-rose-400", label: "Removed" },
    [ActivityAction.PROGRESS]: { icon: Play, color: "text-violet-400", label: "Watched" },
    [ActivityAction.STATUS_CHANGED]: { icon: RefreshCw, color: "text-amber-400", label: "Status" },
    [ActivityAction.SCORED]: { icon: Star, color: "text-yellow-400", label: "Rated" },
    [ActivityAction.NOTED]: { icon: FileText, color: "text-slate-400", label: "Noted" },
};

function buildMediaHref(source: string, externalId: string) {
    return `/media/${source.toLowerCase()}-${externalId}`;
}

function formatPayloadText(action: string, payload: unknown, title: string): string {
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

function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "yesterday";
    if (diffDay < 7) return `${diffDay}d ago`;

    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: new Date(date).getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getDateGroupLabel(date: Date): string {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (isSameDay(date, now)) return "Today";
    if (isSameDay(date, yesterday)) return "Yesterday";

    return new Date(date).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: new Date(date).getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
}

function groupByDate(items: ActivityLogItem[]): [string, ActivityLogItem[]][] {
    const groups = new Map<string, ActivityLogItem[]>();
    for (const item of items) {
        const key = getDateGroupLabel(new Date(item.createdAt));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
}

function ActivityEntry({ item, onDelete }: { item: ActivityLogItem; onDelete: (id: string) => void }) {
    const config = ACTION_CONFIG[item.action] ?? ACTION_CONFIG[ActivityAction.ADDED];
    const Icon = config.icon;
    const href = buildMediaHref(item.source, item.externalId);
    const text = formatPayloadText(item.action, item.payload, item.title);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleting(true);
        onDelete(item.id); // optimistic — remove immediately
        try {
            await deleteActivityLog(item.id);
        } catch {
            // server action failed — the item was already removed from UI, nothing to revert visually
        }
    };

    return (
        <div className={cn("flex items-start gap-3 py-3 px-4 hover:bg-white/3 transition-all group", deleting && "opacity-0 scale-95 pointer-events-none")}>
            {/* Poster */}
            <div className="shrink-0 w-8 h-12 rounded-md overflow-hidden bg-white/5 border border-white/10">
                {item.poster ? (
                    <Image
                        src={item.poster}
                        alt={item.title}
                        width={32}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Icon className={cn("h-3 w-3", config.color)} />
                    </div>
                )}
            </div>

            {/* Icon badge */}
            <div className={cn("shrink-0 mt-0.5 p-1.5 rounded-lg bg-white/5 border border-white/10", config.color)}>
                <Icon className="h-3.5 w-3.5" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
                <p
                    className="text-sm text-muted-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: text.replace(/<b>(.*?)<\/b>/g, `<a href="${href}" class="font-semibold text-white hover:text-primary transition-colors">$1</a>`) }}
                />
                {item.isBackfill && (
                    <span className="inline-flex items-center gap-1 mt-0.5 text-xs text-white/25">
                        <Clock className="h-2.5 w-2.5" />
                        historical
                    </span>
                )}
            </div>

            {/* Timestamp + delete */}
            <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">
                    {formatRelativeTime(new Date(item.createdAt))}
                </span>
                <button
                    onClick={handleDelete}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-white/30 hover:text-rose-400 hover:bg-rose-400/10"
                    aria-label="Delete entry"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export function HistoryFeed({ initialItems, initialNextCursor, userId }: Props) {
    const [items, setItems] = useState<ActivityLogItem[]>(initialItems);
    const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [filterActions, setFilterActions] = useState<string[]>([]);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Re-fetch from the top whenever filters change
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const data = await getActivityLog(userId, undefined, filterActions.length > 0 ? filterActions : undefined);
                if (!cancelled) {
                    setItems(data.items);
                    setNextCursor(data.nextCursor);
                }
            } catch (e) {
                console.error("Failed to filter history:", e);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterActions]);

    const toggleFilter = (action: string) => {
        setFilterActions((prev) => prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]);
    };

    const handleDelete = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            await backfillActivityLog(userId);
            const data = await getActivityLog(userId, undefined, filterActions.length > 0 ? filterActions : undefined);
            setItems(data.items);
            setNextCursor(data.nextCursor);
        } catch (e) {
            console.error("Failed to regenerate history:", e);
        } finally {
            setIsRegenerating(false);
        }
    };

    const loadMore = useCallback(async () => {
        if (!nextCursor || isLoading) return;
        setIsLoading(true);
        try {
            const data = await getActivityLog(userId, nextCursor, filterActions.length > 0 ? filterActions : undefined);
            setItems((prev) => [...prev, ...data.items]);
            setNextCursor(data.nextCursor);
        } catch (e) {
            console.error("Failed to load more history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [nextCursor, isLoading, userId, filterActions]);

    useEffect(() => {
        const el = loadMoreRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) loadMore();
            },
            { rootMargin: "200px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore]);

    const isEmpty = items.length === 0 && !isLoading;

    if (isEmpty && filterActions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Clock className="h-8 w-8 text-white/30" />
                </div>
                <p className="text-lg font-semibold text-white/60">No activity yet</p>
                <p className="text-sm text-white/30 mt-1">Your actions will appear here as you use the app.</p>
            </div>
        );
    }

    const groups = groupByDate(items);
    const showEmptyFiltered = isEmpty && filterActions.length > 0;

    return (
        <div className="space-y-6">
            {/* Filter bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {FILTER_OPTIONS.map((opt) => {
                        const isActive = filterActions.includes(opt.action);
                        return (
                            <button
                                key={opt.action}
                                onClick={() => toggleFilter(opt.action)}
                                className={cn(
                                    "h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
                                    isActive ? opt.activeClass : "bg-white/5 text-gray-500 hover:bg-white/8 hover:text-white",
                                )}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                    {filterActions.length > 0 && (
                        <button
                            onClick={() => setFilterActions([])}
                            className="h-7 px-2 rounded-lg text-xs text-gray-600 hover:text-white transition-colors flex items-center gap-1"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </button>
                    )}
                </div>
                <button
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/50 transition-colors disabled:opacity-50 shrink-0"
                >
                    <RotateCcw className={cn("h-3 w-3", isRegenerating && "animate-spin")} />
                    {isRegenerating ? "Regenerating…" : "Regenerate historical data"}
                </button>
            </div>

            {showEmptyFiltered && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm font-medium text-white/40">No activity matches these filters</p>
                </div>
            )}

            {groups.map(([label, groupItems]) => (
                <div key={label}>
                    <div className="flex items-center gap-3 mb-2 px-4">
                        <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{label}</span>
                        <div className="flex-1 h-px bg-white/5" />
                        <span className="text-xs text-white/25">{groupItems.length}</span>
                    </div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
                        {groupItems.map((item) => (
                            <ActivityEntry key={item.id} item={item} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            ))}

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className="h-4" />

            {isLoading && (
                <div className="flex justify-center py-4">
                    <div className="h-5 w-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
            )}

            {!nextCursor && items.length > 0 && (
                <p className="text-center text-xs text-white/20 pb-8">
                    You&apos;ve reached the beginning of your history
                </p>
            )}
        </div>
    );
}
