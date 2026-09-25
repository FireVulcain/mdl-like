"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getActivityLog, deleteActivityLog, backfillActivityLog } from "@/actions/history";
import { ActivityAction } from "@/types/activity";
import { formatPayloadText } from "@/lib/activity-format";
import { X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Long enough that a fast typist sends one request per word, short enough that
// the feed feels like it is keeping up.
const SEARCH_DEBOUNCE_MS = 250;

// The filterable action types. No colour per action: the same rail as the
// watchlist's status filter, the chosen ones lit.
const FILTER_OPTIONS = [
    { action: ActivityAction.PROGRESS, label: "Watched" },
    { action: ActivityAction.ADDED, label: "Added" },
    { action: ActivityAction.SCORED, label: "Rated" },
    { action: ActivityAction.STATUS_CHANGED, label: "Status" },
    { action: ActivityAction.NOTED, label: "Noted" },
    { action: ActivityAction.REMOVED, label: "Removed" },
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
};

function buildMediaHref(source: string, externalId: string) {
    return `/media/${source.toLowerCase()}-${externalId}`;
}

// The exact time of day: the date is already in the column on the left.
function formatClock(date: Date): string {
    return new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(date: Date): string {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
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

// One entry, as on the public profile's feed: a small poster, the sentence with
// its title in bold, the time on the right. The icon in a bordered tile repeated
// the sentence's verb in one of six colours.
function ActivityEntry({ item, onDelete }: { item: ActivityLogItem; onDelete: (id: string) => void }) {
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
        <div className={cn("flex items-center gap-3 py-2 group transition-opacity", deleting && "opacity-0 pointer-events-none")}>
            <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-fg-faint">{formatClock(new Date(item.createdAt))}</span>
            <Link href={href} className="shrink-0">
                <div className="relative h-9.5 w-6.5 rounded overflow-hidden bg-surface-3">
                    {item.poster && (
                        <Image unoptimized={true} src={item.poster} alt={item.title} fill sizes="26px" className="object-cover" />
                    )}
                </div>
            </Link>

            <p className="flex-1 min-w-0 text-sm text-fg-soft leading-relaxed">
                <span
                    dangerouslySetInnerHTML={{
                        __html: text.replace(
                            /<b>(.*?)<\/b>/g,
                            `<a href="${href}" class="font-medium text-fg hover:underline underline-offset-2">$1</a>`,
                        ),
                    }}
                />
                {item.isBackfill && <span className="ml-1.5 text-xs text-fg-faint">historical</span>}
            </p>

            
            <button
                onClick={handleDelete}
                className="shrink-0 grid h-6 w-6 place-items-center rounded-md text-fg-faint opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-fg transition-opacity cursor-pointer"
                aria-label="Delete entry"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

export function HistoryFeed({ initialItems, initialNextCursor }: Props) {
    const [items, setItems] = useState<ActivityLogItem[]>(initialItems);
    const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
    const [isLoading, setIsLoading] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [filterActions, setFilterActions] = useState<string[]>([]);
    // `query` is what the input shows, `search` is what the server has been
    // asked for — they differ for one debounce interval while typing.
    const [query, setQuery] = useState("");
    const [search, setSearch] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Re-fetch from the top whenever filters or the search change
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setIsLoading(true);
            try {
                const data = await getActivityLog(undefined, filterActions.length > 0 ? filterActions : undefined, search || undefined);
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
        return () => {
            cancelled = true;
        };
    }, [filterActions, search]);

    // Debounced from the change handler rather than an effect, so the input
    // stays uncontrolled-fast and only the fetch waits.
    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    const handleQueryChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => setSearch(value.trim()), SEARCH_DEBOUNCE_MS);
    };

    const clearSearch = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setQuery("");
        setSearch("");
    };

    const toggleFilter = (action: string) => {
        setFilterActions((prev) => (prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]));
    };

    const handleDelete = useCallback((id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            await backfillActivityLog();
            const data = await getActivityLog(undefined, filterActions.length > 0 ? filterActions : undefined, search || undefined);
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
            const data = await getActivityLog(nextCursor, filterActions.length > 0 ? filterActions : undefined, search || undefined);
            setItems((prev) => [...prev, ...data.items]);
            setNextCursor(data.nextCursor);
        } catch (e) {
            console.error("Failed to load more history:", e);
        } finally {
            setIsLoading(false);
        }
    }, [nextCursor, isLoading, filterActions, search]);

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

    if (isEmpty && filterActions.length === 0 && search.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                
                <p className="text-lg font-semibold text-fg-muted">No activity yet</p>
                <p className="text-sm text-fg-faint mt-1">Your actions will appear here as you use the app.</p>
            </div>
        );
    }

    const groups = groupByDate(items);
    const showEmptyFiltered = isEmpty && (filterActions.length > 0 || search.length > 0);

    return (
        <div className="space-y-6">
            {/* Search + filter bar */}
            <div className="space-y-2.5">
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-dim group-focus-within:text-primary transition-colors pointer-events-none" />
                    <Input
                        value={query}
                        onChange={(e) => handleQueryChange(e.target.value)}
                        placeholder="Search your history…"
                        aria-label="Search your history"
                        className="w-full h-9 pl-9 pr-9 bg-surface-2 border-0 rounded-lg text-sm text-fg placeholder:text-fg-dim focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:bg-surface-3 transition-all"
                    />
                    {query.length > 0 && (
                        <button
                            onClick={clearSearch}
                            aria-label="Clear search"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-fg-faint hover:text-fg transition-colors cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-surface-2 p-0.75">
                        {FILTER_OPTIONS.map((opt) => {
                            const isActive = filterActions.includes(opt.action);
                            return (
                                <button
                                    key={opt.action}
                                    onClick={() => toggleFilter(opt.action)}
                                    aria-pressed={isActive}
                                    className={cn(
                                        "h-7 px-2.5 rounded-md text-[13px] transition-colors cursor-pointer",
                                        isActive ? "bg-surface-4 font-medium text-fg" : "text-fg-muted hover:text-fg",
                                    )}
                                >
                                    {opt.label}
                                </button>
                            );
                        })}
                        </div>
                        {filterActions.length > 0 && (
                            <button
                                onClick={() => setFilterActions([])}
                                className="text-[13px] text-fg-dim hover:text-fg transition-colors cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleRegenerate}
                        disabled={isRegenerating}
                        className="text-[13px] text-fg-dim hover:text-fg transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                        {isRegenerating ? "Regenerating…" : "Regenerate historical data"}
                    </button>
                </div>
            </div>

            {showEmptyFiltered && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm font-medium text-fg-dim">
                        {search.length > 0 ? `No activity matches “${search}”` : "No activity matches these filters"}
                    </p>
                </div>
            )}

            {/* Each day as a row of two columns: the date on the left, its entries
                on the right with their time of day. Reads like a diary. */}
            {groups.map(([label, groupItems]) => (
                <div key={label} className="grid gap-x-5 gap-y-1 border-t border-line-soft pt-3 md:grid-cols-[110px_1fr]">
                    <h2 className="text-sm font-semibold leading-snug text-fg md:pt-2">
                        {label}
                        <span className="block text-xs font-normal text-fg-dim tabular-nums">
                            {label === "Today" || label === "Yesterday" ? `${formatShortDate(new Date(groupItems[0].createdAt))} · ` : ""}
                            {groupItems.length} {groupItems.length === 1 ? "entry" : "entries"}
                        </span>
                    </h2>
                    <div className="divide-y divide-line-soft min-w-0">
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
                    <div className="h-5 w-5 rounded-full border-2 border-line-strong border-t-fg-muted animate-spin" />
                </div>
            )}

            {!nextCursor && items.length > 0 && (
                <p className="text-center text-xs text-fg-faint pb-8">You&apos;ve reached the beginning of your history</p>
            )}
        </div>
    );
}
