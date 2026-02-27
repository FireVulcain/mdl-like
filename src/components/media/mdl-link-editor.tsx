"use client";

import { useState, useTransition, useEffect } from "react";
import Image from "next/image";
import { Link2, Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { kuryanaSearch, KuryanaSearchResult } from "@/lib/kuryana";
import { updateMdlLink } from "@/actions/mdl-editor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MdlLinkEditorProps {
    tmdbExternalId: string;
    mediaType: "tv" | "movie";
    currentSlug?: string | null;
    defaultQuery?: string;
}

export function MdlLinkEditor({ tmdbExternalId, mediaType, currentSlug, defaultQuery }: MdlLinkEditorProps) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState(defaultQuery || "");
    const [results, setResults] = useState<KuryanaSearchResult["results"]["dramas"]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isPending, startTransition] = useTransition();

    const debouncedSearch = useDebounce(async (q: string) => {
        if (!q || q.length < 2) {
            setResults([]);
            setIsSearching(false);
            return;
        }

        try {
            setIsSearching(true);
            const res = await kuryanaSearch(q);
            // Only show dramas/movies (not people)
            if (res && res.results && res.results.dramas) {
                setResults(res.results.dramas);
            } else {
                setResults([]);
            }
        } catch (e) {
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
                    className="flex shrink-0 h-6 items-center gap-1.5 px-2 py-1 rounded bg-white/[0.03] hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                    title="Edit MDL Link"
                >
                    <Link2 className="h-3 w-3" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl bg-gray-900 border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-white">Link MDL Entry</DialogTitle>
                    <DialogDescription className="text-gray-400">Search and select the correct MDL entry for this TMDB show.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Type an english or native title..."
                            value={query}
                            onChange={handleSearch}
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-sky-500/50"
                            autoFocus
                        />
                    </div>

                    <div className="min-h-[200px]">
                        {isSearching || isPending ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="h-6 w-6 text-sky-400 animate-spin" />
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
                                {query.trim().length >= 2 ? "No results found." : "Start typing to search…"}
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-1">
                                {results.map((item: any) => {
                                    const isCurrent = currentSlug && item.slug.includes(currentSlug);

                                    return (
                                        <button
                                            key={item.slug}
                                            onClick={() => handleSelect(item.slug)}
                                            disabled={isPending || isCurrent}
                                            className="cursor-pointer group text-left space-y-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 group-hover:ring-sky-500/50 transition-all bg-gray-800">
                                                {item.thumb ? (
                                                    <Image src={item.thumb} alt={item.title} fill unoptimized={true} className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
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
                                                <p className="text-xs font-medium text-white group-hover:text-sky-400 transition-colors line-clamp-2 leading-tight">
                                                    {item.title}
                                                </p>
                                                <p className="text-[10px] text-gray-500 mt-0.5 capitalize">{item.type || mediaType}</p>
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
