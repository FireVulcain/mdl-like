"use client";

import { useState, useEffect, useRef } from "react";
import { saveHomeExcludedTags } from "@/actions/preferences";
import { DEFAULT_EXCLUDED_TAGS, type ExcludedTag } from "@/lib/home-preferences";
import { Search, X, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface TagResult {
    id: number;
    name: string;
    description: string;
}

export function HomeExcludedTagsSetting({
    initialTags,
    initialApplyToBrowse = false,
}: {
    initialTags: ExcludedTag[];
    initialApplyToBrowse?: boolean;
}) {
    const [tags, setTags] = useState<ExcludedTag[]>(initialTags);
    const [applyToBrowse, setApplyToBrowse] = useState(initialApplyToBrowse);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<TagResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Debounced tag search (same endpoint as the /dramas filter panel)
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

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const update = (next: ExcludedTag[]) => {
        setTags(next);
        setDirty(true);
    };

    const addTag = (tag: TagResult) => {
        if (!tags.some((t) => t.id === tag.id)) {
            update([...tags, { id: tag.id, name: tag.name }]);
        }
        setQuery("");
        setOpen(false);
    };

    const save = async () => {
        setSaving(true);
        try {
            await saveHomeExcludedTags(tags, applyToBrowse);
            setDirty(false);
            toast.success("Home preferences saved");
        } catch {
            toast.error("Failed to save preferences");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                    <span
                        key={tag.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm"
                    >
                        {tag.name}
                        <button
                            onClick={() => update(tags.filter((t) => t.id !== tag.id))}
                            className="cursor-pointer text-rose-400/60 hover:text-rose-300 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </span>
                ))}
                {tags.length === 0 && <p className="text-sm text-gray-500 py-1">No tags excluded — all titles show up.</p>}
            </div>

            <div className="relative max-w-sm" ref={containerRef}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 bg-white/5 focus-within:border-white/25 focus-within:bg-white/8 transition-all">
                    {loading ? (
                        <Loader2 className="h-4 w-4 text-gray-500 shrink-0 animate-spin" />
                    ) : (
                        <Search className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search a tag to exclude…"
                        className="bg-transparent text-sm text-gray-300 placeholder-gray-600 outline-none w-full"
                    />
                    {query && (
                        <button
                            onClick={() => { setQuery(""); setOpen(false); }}
                            className="text-gray-600 hover:text-gray-400 transition-colors shrink-0 cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {open && results.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full bg-gray-800 border border-white/10 rounded-lg shadow-xl max-h-56 overflow-y-auto">
                        {results.map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => addTag(tag)}
                                disabled={tags.some((t) => t.id === tag.id)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/8 hover:text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span className="capitalize">{tag.name}</span>
                                {tag.description && <span className="block text-xs text-gray-500 line-clamp-1">{tag.description}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button
                onClick={() => { setApplyToBrowse(!applyToBrowse); setDirty(true); }}
                className="cursor-pointer flex items-center gap-3 group"
            >
                <span className={`relative h-6 w-11 rounded-full transition-colors ${applyToBrowse ? "bg-blue-500" : "bg-white/10"}`}>
                    <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                            applyToBrowse ? "left-5.5" : "left-0.5"
                        }`}
                    />
                </span>
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors text-left">
                    Also apply on the Dramas browse page
                    <span className="block text-xs text-gray-600">
                        Applied as default filters — you can lift them for a visit from the filter panel there.
                    </span>
                </span>
            </button>

            <div className="flex items-center gap-3 pt-1">
                <button
                    onClick={save}
                    disabled={saving || !dirty}
                    className="cursor-pointer h-9 px-5 rounded-lg bg-blue-500 hover:bg-blue-400 text-gray-900 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    {saving ? "Saving..." : "Save"}
                </button>
                <button
                    onClick={() => update(DEFAULT_EXCLUDED_TAGS)}
                    className="cursor-pointer flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset to defaults
                </button>
            </div>
        </div>
    );
}
