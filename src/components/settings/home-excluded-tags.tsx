"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { saveHomeExcludedTags } from "@/actions/preferences";
import { DEFAULT_EXCLUDED_TAGS, type ExcludedTag } from "@/lib/home-preferences";
import { X, Loader2 } from "lucide-react";
import { Switch, settingsButton, settingsInput, settingsLink } from "@/components/settings/settings-ui";
import { toast } from "sonner";

// Tallest the results panel is allowed to be, and the gap it keeps from the
// field and from the fixed header it must not slide under.
const PANEL_MAX = 224;
const PANEL_GAP = 8;
const HEADER_HEIGHT = 96;

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
    // Which side the results open on, and how tall they may get. The field sits
    // near the bottom of a long settings page, where a panel that always drops
    // downwards runs off the viewport and hides its own last rows.
    const [panel, setPanel] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: PANEL_MAX });

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

    // Measured after the panel is in the tree but before the browser paints, so
    // it never shows in the wrong place for a frame.
    useLayoutEffect(() => {
        if (!open || results.length === 0) return;
        const measure = () => {
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const below = window.innerHeight - rect.bottom - PANEL_GAP;
            const above = rect.top - HEADER_HEIGHT - PANEL_GAP;
            // Downwards unless the room up there is both sufficient and better —
            // a panel that flips for a few pixels of gain is more surprising than
            // one that is a little short.
            const up = below < PANEL_MAX && above > below;
            setPanel({ up, maxHeight: Math.min(PANEL_MAX, Math.max(120, up ? above : below)) });
        };
        measure();
        // Scrolling with the panel open moves the field but not the decision,
        // and a panel left pointing the wrong way is worse than one that never
        // flipped. Passive: this only reads geometry.
        window.addEventListener("scroll", measure, { passive: true });
        window.addEventListener("resize", measure);
        return () => {
            window.removeEventListener("scroll", measure);
            window.removeEventListener("resize", measure);
        };
    }, [open, results.length]);

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
        <div className="grid max-w-xl gap-3.5">
            <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                    <span key={tag.id} className="inline-flex h-7 items-center gap-0.5 rounded-md bg-surface-3 pl-2.5 pr-1 text-[13px] text-fg-soft">
                        {tag.name}
                        <button
                            type="button"
                            onClick={() => update(tags.filter((t) => t.id !== tag.id))}
                            aria-label={`Remove ${tag.name}`}
                            className="grid size-5 cursor-pointer place-items-center rounded text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
                {tags.length === 0 && <p className="py-1 text-[13px] text-fg-dim">No tags excluded, all titles show up.</p>}
            </div>

            <div className="relative max-w-sm" ref={containerRef}>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Add a tag…"
                    aria-label="Search a tag to exclude"
                    className={`${settingsInput} pr-8`}
                />
                {loading ? (
                    <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-dim" />
                ) : query ? (
                    <button
                        type="button"
                        onClick={() => { setQuery(""); setOpen(false); }}
                        aria-label="Clear"
                        className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-fg-faint transition-colors hover:text-fg"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                ) : null}

                {open && results.length > 0 && (
                    <div
                        className={`absolute z-30 w-full overflow-y-auto rounded-lg bg-box shadow-(--menu-shadow) ${panel.up ? "bottom-full mb-1" : "mt-1"}`}
                        style={{ maxHeight: panel.maxHeight }}
                    >
                        {results.map((tag) => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => addTag(tag)}
                                disabled={tags.some((t) => t.id === tag.id)}
                                className="w-full cursor-pointer px-3 py-2 text-left text-[13px] text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <span className="capitalize">{tag.name}</span>
                                {tag.description && <span className="block text-xs text-fg-dim line-clamp-1">{tag.description}</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <Switch
                    label="Also apply on the Dramas browse page"
                    checked={applyToBrowse}
                    onChange={(next) => { setApplyToBrowse(next); setDirty(true); }}
                />
                <span className="text-[13px] text-fg-soft">
                    Also apply on the Dramas browse page
                    <span className="block text-xs text-fg-dim">Applied as default filters; you can lift them for a visit from the filter panel there.</span>
                </span>
            </div>

            <div className="flex items-center gap-4">
                <button type="button" onClick={save} disabled={saving || !dirty} className={settingsButton}>
                    {saving ? "Saving…" : "Save tags"}
                </button>
                <button type="button" onClick={() => update(DEFAULT_EXCLUDED_TAGS)} className={settingsLink}>
                    Reset to defaults
                </button>
            </div>
        </div>
    );
}
