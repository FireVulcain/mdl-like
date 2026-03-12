"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface TagResult {
    id: number;
    name: string;
    description: string;
}

interface Props {
    activeTagId?: string;
    activeTagName?: string;
}

export function TagSearchFilter({ activeTagId, activeTagName }: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TagResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounced fetch
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/tags/search?q=${encodeURIComponent(query)}`);
                const data: TagResult[] = await res.json();
                setResults(data);
                setOpen(true);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    function selectTag(tag: TagResult) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tag", String(tag.id));
        params.set("tag_name", tag.name);
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
        setQuery("");
        setOpen(false);
    }

    function clearTag() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        params.delete("tag_name");
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
    }

    return (
        <div className="space-y-2" ref={containerRef}>
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Themes / Tags</h4>
                {activeTagId && (
                    <button onClick={clearTag} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">
                        Clear
                    </button>
                )}
            </div>

            {/* Active tag pill */}
            {activeTagId && activeTagName && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 border border-white/20 w-fit max-w-full">
                    <span className="text-xs text-white truncate">{activeTagName}</span>
                    <button onClick={clearTag} className="shrink-0 text-gray-400 hover:text-white transition-colors">
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            {/* Search input */}
            <div className="relative">
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 focus-within:border-white/25 focus-within:bg-white/8 transition-all">
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 text-gray-500 shrink-0 animate-spin" />
                    ) : (
                        <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                    )}
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tags…"
                        className="bg-transparent text-xs text-gray-300 placeholder-gray-600 outline-none w-full"
                    />
                    {query && (
                        <button onClick={() => { setQuery(""); setOpen(false); }} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {open && results.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                        {results.map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => selectTag(tag)}
                                className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/8 hover:text-white transition-all capitalize cursor-pointer"
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                )}

                {open && !loading && results.length === 0 && query.length >= 2 && (
                    <div className="absolute z-30 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl px-3 py-2 text-xs text-gray-500">
                        No tags found
                    </div>
                )}
            </div>
        </div>
    );
}
