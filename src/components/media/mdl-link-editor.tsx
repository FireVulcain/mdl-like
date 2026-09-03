"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Link2, Search, Loader2, RefreshCw, Ban, Link2Off } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { KuryanaDrama } from "@/lib/kuryana";
import { updateMdlLink, toggleMdlDisabled, unlinkMdl } from "@/actions/mdl-editor";
import { searchMdlDramas } from "@/actions/mdl-season";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MdlLinkEditorProps {
    tmdbExternalId: string;
    mediaType: "tv" | "movie";
    currentSlug?: string | null;
    defaultQuery?: string;
    mediaId?: string;
    isDisabled?: boolean;
}

export function MdlLinkEditor({ tmdbExternalId, mediaType, currentSlug, defaultQuery, mediaId, isDisabled = false }: MdlLinkEditorProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(defaultQuery || "");
    const [results, setResults] = useState<KuryanaDrama[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isTogglingBlock, setIsTogglingBlock] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);

    async function handleRefresh() {
        if (!mediaId) return;
        setIsRefreshing(true);
        try {
            const res = await fetch("/api/mdl/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tmdbExternalId, mediaId }),
            });
            if (!res.ok) throw new Error();
            toast.success("MDL data refreshed");
            setOpen(false);
            router.refresh();
        } catch {
            toast.error("Failed to refresh MDL cache");
        } finally {
            setIsRefreshing(false);
        }
    }

    async function handleToggleBlock() {
        setIsTogglingBlock(true);
        try {
            const result = await toggleMdlDisabled(tmdbExternalId, !isDisabled);
            if (result.success) {
                toast.success(isDisabled ? "MDL lookups re-enabled" : "MDL lookups blocked for this show");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update MDL block state.");
            }
        } finally {
            setIsTogglingBlock(false);
        }
    }

    async function handleUnlink() {
        setIsUnlinking(true);
        try {
            const result = await unlinkMdl(tmdbExternalId);
            if (result.success) {
                toast.success("MDL entry unlinked — link one manually to restore it");
                setOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Failed to unlink MDL entry.");
            }
        } finally {
            setIsUnlinking(false);
        }
    }

    const debouncedSearch = useDebounce(async (q: string) => {
        if (!q || q.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        try {
            setIsSearching(true);
            // Goes through a server action — the scraper has no CORS headers, so
            // the browser can't call it directly.
            setResults(await searchMdlDramas(q));
        } catch {
            toast.error("Failed to search MDL.");
        } finally {
            setIsSearching(false);
        }
    }, 500);

    // Initial search if default query provided
    useEffect(() => {
        if (open && defaultQuery && query === defaultQuery && results.length === 0) {
            debouncedSearch(defaultQuery);
        }
    }, [open, defaultQuery]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        debouncedSearch(val);
    };

    const handleSelect = (slug: string) => {
        const fullSlug = slug.replace("/titles/", ""); // e.g. "12345-my-drama"

        startTransition(async () => {
            const result = await updateMdlLink(tmdbExternalId, fullSlug);
            if (result.success) {
                toast.success("MDL Link updated successfully!");
                setOpen(false);
            } else {
                toast.error(result.error || "Failed to link.");
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className={cn(
                        "flex shrink-0 h-6 items-center gap-1.5 px-2 py-1 rounded transition-colors",
                        isDisabled
                            ? "bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400"
                            : "bg-surface-1 hover:bg-surface-4 text-fg-dim hover:text-fg"
                    )}
                    title={isDisabled ? "MDL blocked — click to manage" : "Edit MDL Link"}
                >
                    {isDisabled ? <Link2Off className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-panel border-line-strong">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-2 pr-8">
                        <DialogTitle className="text-fg">Link MDL Entry</DialogTitle>
                        <div className="flex items-center gap-1">
                            {mediaId && (
                                <button
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    title="Refresh MDL cache"
                                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-fg-muted hover:text-fg hover:bg-surface-4 transition-colors disabled:opacity-40"
                                >
                                    <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
                                    Refresh cache
                                </button>
                            )}
                            {currentSlug && !isDisabled && (
                                <button
                                    onClick={handleUnlink}
                                    disabled={isUnlinking}
                                    title="Remove this MDL link (stays unlinked until you link one manually)"
                                    className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-fg-muted hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                                >
                                    <Link2Off className={`h-3 w-3 ${isUnlinking ? "animate-pulse" : ""}`} />
                                    Unlink
                                </button>
                            )}
                            <button
                                onClick={handleToggleBlock}
                                disabled={isTogglingBlock}
                                title={isDisabled ? "Re-enable MDL lookups" : "Block MDL lookups for this show"}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors disabled:opacity-40",
                                    isDisabled
                                        ? "text-red-400 hover:text-fg hover:bg-red-500/20"
                                        : "text-fg-muted hover:text-red-400 hover:bg-red-500/10"
                                )}
                            >
                                <Ban className="h-3 w-3" />
                                {isDisabled ? "Unblock MDL" : "Block MDL"}
                            </button>
                        </div>
                    </div>
                    <DialogDescription className="text-fg-muted">Search and select the correct MDL entry for this TMDB show.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
                        <Input
                            placeholder="Type an english or native title..."
                            value={query}
                            onChange={handleSearch}
                            className="pl-9 bg-surface-2 border-line-strong text-fg placeholder:text-fg-dim focus:border-sky-500/50"
                            autoFocus
                        />
                    </div>

                    <div className="min-h-50">
                        {isSearching || isPending ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex items-center justify-center h-48 text-fg-dim text-sm">
                                {query.trim().length >= 2 ? "No results found." : "Start typing to search…"}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-100 overflow-y-auto pr-1">
                                {results.map((item) => {
                                    const isCurrent = !!currentSlug && item.slug.includes(currentSlug);

                                    return (
                                        <button
                                            key={item.slug}
                                            onClick={() => handleSelect(item.slug)}
                                            disabled={isPending || isCurrent}
                                            className="cursor-pointer group text-left space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-line-strong group-hover:ring-sky-500/50 transition-all bg-surface-3">
                                                {item.thumb ? (
                                                    <Image src={item.thumb} alt={item.title} fill unoptimized={true} className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-fg-dim">
                                                        No Image
                                                    </div>
                                                )}
                                                {isCurrent && (
                                                    <div className="absolute top-1.5 left-1.5 z-10">
                                                        <Badge className="bg-sky-500/90 text-white text-[10px] px-1.5 border hover:bg-sky-500/90 shadow-md">
                                                            Current
                                                        </Badge>
                                                    </div>
                                                )}
                                                {item.year && (
                                                    <div className="absolute top-1.5 right-1.5 z-10">
                                                        <Badge className="bg-black/60 text-white text-[10px] px-1.5 border hover:bg-black/60 font-mono">
                                                            {item.year}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-fg group-hover:text-sky-400 transition-colors line-clamp-2 leading-tight">
                                                    {item.title}
                                                </p>
                                                <p className="text-[10px] text-fg-dim mt-0.5 capitalize">{item.type || mediaType}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
