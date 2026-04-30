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
    activeTagExcludeId?: string;
    activeTagExcludeName?: string;
}

export function TagSearchFilter({ activeTagId, activeTagName, activeTagExcludeId, activeTagExcludeName }: Props) {
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

    function selectTag(tag: TagResult, exclude = false) {
        const params = new URLSearchParams(searchParams.toString());
        // Clear both first, then set the chosen mode
        params.delete("tag");
        params.delete("tag_name");
        params.delete("tag_exclude");
        params.delete("tag_exclude_name");
        if (exclude) {
            params.set("tag_exclude", String(tag.id));
            params.set("tag_exclude_name", tag.name);
        } else {
            params.set("tag", String(tag.id));
            params.set("tag_name", tag.name);
        }
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
        setQuery("");
        setOpen(false);
    }

    function toggleTagMode(toExclude: boolean) {
        const params = new URLSearchParams(searchParams.toString());
        if (toExclude && activeTagId && activeTagName) {
            params.delete("tag");
            params.delete("tag_name");
            params.set("tag_exclude", activeTagId);
            params.set("tag_exclude_name", activeTagName);
        } else if (!toExclude && activeTagExcludeId && activeTagExcludeName) {
            params.delete("tag_exclude");
            params.delete("tag_exclude_name");
            params.set("tag", activeTagExcludeId);
            params.set("tag_name", activeTagExcludeName);
        }
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
    }

    function clearTag() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        params.delete("tag_name");
        params.delete("tag_exclude");
        params.delete("tag_exclude_name");
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
    }

    const hasActive = !!(activeTagId || activeTagExcludeId);
    const activeName = activeTagName || activeTagExcludeName;
    const isExcluded = !!activeTagExcludeId;

    return (
        <div className="space-y-2" ref={containerRef}>
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Themes / Tags</h4>
                {hasActive && (
                    <button onClick={clearTag} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                        Clear
                    </button>
                )}
            </div>

            {/* Active tag pill — click pill to toggle include/exclude, × to clear */}
            {hasActive && activeName && (
                <div className="flex items-center gap-1 w-fit max-w-full">
                    <button
                        onClick={() => toggleTagMode(!isExcluded)}
                        title={isExcluded ? "Click to include" : "Click to exclude"}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                            isExcluded
                                ? "bg-red-500 text-white hover:bg-red-600"
                                : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }`}
                    >
                        {activeName}
                    </button>
                    <button onClick={clearTag} className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer">
                        <X className="h-3.5 w-3.5" />
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
                        <button onClick={() => { setQuery(""); setOpen(false); }} className="text-gray-600 hover:text-gray-400 transition-colors shrink-0 cursor-pointer">
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {open && results.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                        {results.map((tag) => (
                            <div key={tag.id} className="flex items-stretch border-b border-white/5 last:border-0">
                                <button
                                    onClick={() => selectTag(tag, false)}
                                    className="flex-1 text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/8 hover:text-white transition-all capitalize cursor-pointer"
                                >
                                    {tag.name}
                                </button>
                                <button
                                    onClick={() => selectTag(tag, true)}
                                    title="Exclude this tag"
                                    className="px-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer border-l border-white/5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
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
