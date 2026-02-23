"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import Image from "next/image";
import { Link2, Search, Check, Loader2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchMdlDramas, setMdlSeasonSlug } from "@/actions/mdl-season";
import type { KuryanaDrama } from "@/lib/kuryana";

interface Props {
    tmdbExternalId: string;
    season: number;
    mediaId: string;
    title: string;
}

export function MdlSeasonLinkButton({ tmdbExternalId, season, mediaId, title }: Props) {
    const defaultQuery = `${title} Season ${season}`;

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(defaultQuery);
    const [results, setResults] = useState<KuryanaDrama[]>([]);
    const [searching, setSearching] = useState(false);
    const [linked, setLinked] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const initialSearching = useRef(false);

    // Debounced search when user types
    useEffect(() => {
        if (initialSearching.current) return;
        if (!open || !query.trim()) return;
        const timer = setTimeout(async () => {
            setSearching(true);
            const res = await searchMdlDramas(query);
            setResults(res);
            setSearching(false);
        }, 400);
        return () => clearTimeout(timer);
    }, [query, open]);

    // Auto-search on open
    useEffect(() => {
        if (!open) return;
        initialSearching.current = true;
        setResults([]);
        setSearching(true);
        searchMdlDramas(defaultQuery).then((res) => {
            setResults(res);
            setSearching(false);
            initialSearching.current = false;
        });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleOpen() {
        setOpen(true);
        setLinked(null);
        setError(null);
        setQuery(defaultQuery);
    }

    function handleSelect(drama: KuryanaDrama) {
        setError(null);
        startTransition(async () => {
            try {
                await setMdlSeasonSlug(tmdbExternalId, season, drama.slug, mediaId);
                setLinked(drama.title);
            } catch {
                setError("Something went wrong.");
            }
        });
    }

    return (
        <>
            <button
                onClick={handleOpen}
                className="flex items-center gap-1.5 text-xs text-sky-400/70 hover:text-sky-400 transition-colors"
            >
                <Link2 className="size-3" />
                Link MDL Season {season}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">
                            Link Season {season} to MDL
                        </DialogTitle>
                    </DialogHeader>

                    {linked ? (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="h-12 w-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                <Check className="h-6 w-6 text-emerald-400" />
                            </div>
                            <p className="text-white font-medium">Linked successfully!</p>
                            <p className="text-sm text-gray-400 text-center">
                                Season {season} is now linked to &ldquo;{linked}&rdquo; on MDL.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search MDL…"
                                    className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-sky-500/50"
                                    autoFocus
                                />
                            </div>

                            {error && <p className="text-sm text-red-400">{error}</p>}

                            <div className="min-h-50">
                                {searching || isPending ? (
                                    <div className="flex items-center justify-center h-48">
                                        <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
                                    </div>
                                ) : results.length === 0 ? (
                                    <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                                        {query.trim() ? "No results found." : "Start typing to search…"}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-100 overflow-y-auto pr-1">
                                        {results.map((drama) => (
                                            <button
                                                key={drama.slug}
                                                onClick={() => handleSelect(drama)}
                                                disabled={isPending}
                                                className="cursor-pointer group text-left space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 group-hover:ring-sky-500/50 transition-all bg-gray-800">
                                                    {drama.thumb ? (
                                                        <Image
                                                            src={drama.thumb}
                                                            alt={drama.title}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                                            No Image
                                                        </div>
                                                    )}
                                                    {drama.ranking && (
                                                        <div className="absolute top-1.5 left-1.5">
                                                            <Badge className="bg-yellow-500/90 text-black text-[10px] px-1.5">
                                                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                                                #{drama.ranking}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium text-white group-hover:text-sky-400 transition-colors line-clamp-2 leading-tight">
                                                        {drama.title}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        {drama.year} · {drama.type}
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
