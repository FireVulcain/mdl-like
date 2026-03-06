"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { fetchMdlSearchResults } from "@/app/search/actions";
import type { UnifiedMedia } from "@/services/media.service";

export function SearchMediaGrid({ media, query }: { media: UnifiedMedia[]; query: string }) {
    const [showMdl, setShowMdl] = useState(false);
    const [mdlResults, setMdlResults] = useState<UnifiedMedia[]>([]);
    const [loading, setLoading] = useState(false);

    async function handleToggle() {
        if (!showMdl && mdlResults.length === 0) {
            setLoading(true);
            const results = await fetchMdlSearchResults(query);
            setMdlResults(results);
            setLoading(false);
        }
        setShowMdl((v) => !v);
    }

    const displayed = showMdl ? [...mdlResults, ...media] : media;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={handleToggle}
                    disabled={loading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 ${
                        showMdl
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                    }`}
                >
                    {loading ? (
                        <Loader2 className="size-3 animate-spin" />
                    ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                    )}
                    {loading ? "Loading MDL…" : "MDL results"}
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayed.map((item) => (
                    <MediaCard key={item.id} media={item} />
                ))}
            </div>
        </div>
    );
}
