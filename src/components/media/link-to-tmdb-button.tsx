"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Link2, Search, Check, Loader2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchTmdbDramas, createMdlLink, getMdlNativeTitle, TmdbSearchResult } from "@/actions/mdl-link";

interface Props {
    mdlSlug: string; // e.g. "687393-the-prisoner-of-beauty"
    defaultQuery: string; // drama title to pre-fill the search
    onLinked?: (tmdbExternalId: string) => void; // called after a successful link
    compact?: boolean; // icon-only button (for image overlay use)
}

export function LinkToTmdbButton({ mdlSlug, defaultQuery, onLinked, compact = false }: Props) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(defaultQuery);
    const [results, setResults] = useState<TmdbSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [linked, setLinked] = useState<string | null>(null); // tmdbExternalId after success
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    // Blocks the debounced effect while the initial open search is in progress
    const initialSearching = useRef(false);

    // Debounced search for when the user manually types after the modal is loaded
    useEffect(() => {
        if (initialSearching.current) return;
        if (!open || !query.trim()) return;
        const timer = setTimeout(async () => {
            setSearching(true);
            const res = await searchTmdbDramas(query);
            setResults(res);
            setSearching(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [query, open]);

    // On open: fetch native title first, then search — spinner shows the whole time
    useEffect(() => {
        if (!open) return;
        initialSearching.current = true;
        setResults([]);
        setSearching(true);
        (async () => {
            try {
                const native = await getMdlNativeTitle(mdlSlug);
                const q = native ?? defaultQuery;
                setQuery(q);
                const res = await searchTmdbDramas(q);
                setResults(res);
            } catch {
                // silently fail, user can still type manually
            } finally {
                setSearching(false);
                initialSearching.current = false;
            }
        })();
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleOpen(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        setLinked(null);
        setError(null);
    }

    function handleSelect(result: TmdbSearchResult) {
        setError(null);
        startTransition(async () => {
            const res = await createMdlLink(mdlSlug, result.externalId);
            if (res.ok) {
                setLinked(result.externalId);
                onLinked?.(result.externalId);
            } else {
                setError(res.error ?? "Something went wrong.");
            }
        });
    }

    return (
        <>
            {compact ? (
                <button
                    onClick={handleOpen}
                    title="Link to TMDB"
                    className="cursor-pointer flex items-center justify-center h-6 w-6 rounded-md bg-black/60 backdrop-blur-sm text-white/60 hover:text-sky-400 hover:bg-sky-500/20 transition-all"
                >
                    <Link2 className="h-3.5 w-3.5" />
                </button>
            ) : (
                <button
                    onClick={handleOpen}
                    title="Link to TMDB"
                    className="cursor-pointer shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-white/40 hover:text-sky-400 hover:bg-sky-500/10 border border-transparent hover:border-sky-500/20 transition-all"
                >
                    <Link2 className="h-3 w-3" />
                    Link
                </button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">Link &ldquo;{defaultQuery}&rdquo; to TMDB</DialogTitle>
                    </DialogHeader>

                    {linked ? (
                        /* Success state */
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <Check className="h-6 w-6 text-emerald-400" />
                            </div>
                            <p className="text-white font-medium">Linked successfully!</p>
                            <p className="text-sm text-gray-400 text-center">
                                MDL data has been fetched and cached. This drama now links to your internal page.
                            </p>
                            <Link
                                href={`/media/tmdb-${linked}`}
                                onClick={() => setOpen(false)}
                                className="cursor-pointer px-4 py-2 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 text-sm font-medium hover:bg-sky-500/30 transition-colors"
                            >
                                Open media page →
                            </Link>
                        </div>
                    ) : (
                        /* Search state */
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search TMDB…"
                                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-sky-500/50"
                                    autoFocus
                                />
                            </div>

                            {error && <p className="text-sm text-red-400">{error}</p>}

                            <div className="min-h-[200px]">
                                {searching || isPending ? (
                                    <div className="flex items-center justify-center h-48">
                                        <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                                        {query.trim() ? "No results found." : "Start typing to search…"}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1">
                                        {results.map((result) => (
                                            <button
                                                key={result.externalId}
                                                onClick={() => handleSelect(result)}
                                                disabled={isPending}
                                                className="cursor-pointer group text-left space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 group-hover:ring-sky-500/50 transition-all bg-gray-800">
                                                    {result.poster ? (
                                                        <Image unoptimized={true}
                                                            src={result.poster}
                                                            alt={result.title}
                                                            fill className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                                            No Image
                                                        </div>
                                                    )}
                                                    {result.rating > 0 && (
                                                        <div className="absolute top-1.5 left-1.5">
                                                            <Badge className="bg-yellow-500/90 text-black text-[10px] px-1.5">
                                                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                                                {result.rating.toFixed(1)}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                    {result.country && (
                                                        <div className="absolute top-1.5 right-1.5">
                                                            <Badge className="bg-black/60 text-white text-[10px] px-1.5 font-mono">
                                                                {result.country}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-white group-hover:text-sky-400 transition-colors line-clamp-2 leading-tight">
                                                        {result.title}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {result.year} · {result.type}
                                                    </p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
