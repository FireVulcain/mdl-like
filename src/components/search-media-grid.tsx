"use client";

import { useState } from "react";
import { MediaCard } from "@/components/media-card";
import type { UnifiedMedia } from "@/services/media.service";

export function SearchMediaGrid({ media }: { media: UnifiedMedia[] }) {
    const [showMdl, setShowMdl] = useState(false);

    const hasMdl = media.some((m) => m.source === "MDL");
    const filtered = showMdl ? media : media.filter((m) => m.source !== "MDL");

    return (
        <div className="space-y-4">
            {hasMdl && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowMdl((v) => !v)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                            showMdl
                                ? "bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                        }`}
                    >
                        <span className="size-1.5 rounded-full bg-current" />
                        MDL results
                    </button>
                </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filtered.map((item) => (
                    <MediaCard key={item.id} media={item} />
                ))}
            </div>
        </div>
    );
}
