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
    // The current exclusions come from Settings defaults, not the URL
    excludedAreDefaults?: boolean;
    // Settings defaults exist for this page — an empty list must be pinned
    // in the URL (no_defaults=1) or they would silently reapply
    hasBrowseDefaults?: boolean;
}

type TagRef = { id: string; name: string };

// tag_exclude is a comma-separated id list; names travel in tag_exclude_name
// joined with "|" (tag names can contain commas — legacy ", " links still parse
// as long as no name contains a comma, else ids stand in as labels).
function parseExcluded(ids?: string, names?: string): TagRef[] {
    const idList = ids?.split(",").filter(Boolean) ?? [];
    if (idList.length === 0) return [];
    let nameList = names?.split("|").filter(Boolean) ?? [];
    if (nameList.length !== idList.length && names?.includes(", ")) {
        nameList = names.split(", ").filter(Boolean);
    }
    return idList.map((id, i) => ({ id, name: nameList[i]?.trim() || `#${id}` }));
}

export function TagSearchFilter({
    activeTagId,
    activeTagName,
    activeTagExcludeId,
    activeTagExcludeName,
    excludedAreDefaults = false,
    hasBrowseDefaults = false,
}: Props) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TagResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const excluded = parseExcluded(activeTagExcludeId, activeTagExcludeName);

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

    function pushWithExcluded(params: URLSearchParams, list: TagRef[]) {
        if (list.length > 0) {
            params.set("tag_exclude", list.map((t) => t.id).join(","));
            params.set("tag_exclude_name", list.map((t) => t.name).join("|"));
            params.delete("no_defaults");
        } else {
            params.delete("tag_exclude");
            params.delete("tag_exclude_name");
            // Pin the empty list, otherwise Settings defaults would reapply
            if (hasBrowseDefaults) params.set("no_defaults", "1");
            else params.delete("no_defaults");
        }
        params.set("page", "1");
        router.push(`/dramas?${params.toString()}`);
    }

    function selectTag(tag: TagResult, exclude = false) {
        const params = new URLSearchParams(searchParams.toString());
        if (exclude) {
            // Append to the exclusion list (dedupe); an excluded tag can't stay included
            if (params.get("tag") === String(tag.id)) {
                params.delete("tag");
                params.delete("tag_name");
            }
            const next = excluded.some((t) => t.id === String(tag.id))
                ? excluded
                : [...excluded, { id: String(tag.id), name: tag.name }];
            pushWithExcluded(params, next);
        } else {
            // Single include tag; drop it from the exclusion list if present
            params.set("tag", String(tag.id));
            params.set("tag_name", tag.name);
            pushWithExcluded(params, excluded.filter((t) => t.id !== String(tag.id)));
        }
        setQuery("");
        setOpen(false);
    }

    function removeExcluded(id: string) {
        const params = new URLSearchParams(searchParams.toString());
        pushWithExcluded(params, excluded.filter((t) => t.id !== id));
    }

    function excludeCurrentInclude() {
        if (!activeTagId || !activeTagName) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        params.delete("tag_name");
        pushWithExcluded(params, [...excluded.filter((t) => t.id !== activeTagId), { id: activeTagId, name: activeTagName }]);
    }

    function includeExcluded(tag: TagRef) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tag", tag.id);
        params.set("tag_name", tag.name);
        pushWithExcluded(params, excluded.filter((t) => t.id !== tag.id));
    }

    function clearInclude() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        params.delete("tag_name");
        pushWithExcluded(params, excluded);
    }

    function clearAll() {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("tag");
        params.delete("tag_name");
        pushWithExcluded(params, []);
    }

    const hasActive = !!(activeTagId || excluded.length > 0);

    return (
        <div className="space-y-2" ref={containerRef}>
            <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Themes / Tags</h4>
                {hasActive && (
                    <button onClick={clearAll} className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors cursor-pointer">
                        Clear
                    </button>
                )}
            </div>

            {/* Active pills — click a pill to flip include/exclude, × to clear it */}
            {hasActive && (
                <div className="flex flex-wrap gap-1.5">
                    {activeTagId && activeTagName && (
                        <div className="flex items-center gap-1 w-fit max-w-full">
                            <button
                                onClick={excludeCurrentInclude}
                                title="Click to exclude"
                                className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
                            >
                                {activeTagName}
                            </button>
                            <button onClick={clearInclude} className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}
                    {excluded.map((tag) => (
                        <div key={tag.id} className="flex items-center gap-1 w-fit max-w-full">
                            <button
                                onClick={() => includeExcluded(tag)}
                                title={excludedAreDefaults ? "Default from Settings — click to include" : "Click to include"}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                                    excludedAreDefaults
                                        ? "bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25"
                                        : "bg-red-500 text-white hover:bg-red-600"
                                }`}
                            >
                                {tag.name}
                            </button>
                            <button
                                onClick={() => removeExcluded(tag.id)}
                                title={excludedAreDefaults ? "Remove for this visit (Settings unchanged)" : undefined}
                                className="shrink-0 text-gray-500 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    ))}
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
