"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronDown, ChevronUp, Star, Clock } from "lucide-react";

interface Episode {
    id: number;
    number: number;
    name: string;
    overview: string;
    airDate: string | null;
    still: string | null;
    runtime: number | null;
    rating: number;
}

interface EpisodeGuideProps {
    episodes: Episode[];
    season: number;
}

function EpisodeRow({ ep }: { ep: Episode }) {
    const [expanded, setExpanded] = useState(false);
    const hasOverview = ep.overview.trim().length > 0;
    const isLong = ep.overview.length > 150;

    const formattedDate = ep.airDate
        ? new Date(ep.airDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : null;

    return (
        <div className="group flex gap-4 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]">
            {/* Episode still */}
            <div className="relative flex-none w-36 aspect-video overflow-hidden rounded-lg bg-gray-800 shadow-md ring-1 ring-white/10">
                {ep.still ? (
                    <Image
                        src={ep.still}
                        alt={ep.name}
                        fill
                        className="object-cover opacity-0 transition-opacity duration-500"
                        loading="lazy"
                        sizes="144px"
                        onLoad={(e) => {
                            (e.currentTarget as HTMLImageElement).classList.replace("opacity-0", "opacity-100");
                        }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center">
                        <span className="text-xs text-gray-500">No image</span>
                    </div>
                )}
                {/* Episode number badge */}
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    Ep {ep.number}
                </span>
            </div>

            {/* Episode info */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-white leading-snug truncate" title={ep.name}>
                        {ep.name}
                    </h4>
                    <div className="flex items-center gap-2 flex-none text-[11px] text-gray-400">
                        {ep.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-yellow-400/90">
                                <Star className="size-3 fill-current" />
                                {ep.rating.toFixed(1)}
                            </span>
                        )}
                        {ep.runtime && (
                            <span className="flex items-center gap-0.5">
                                <Clock className="size-3" />
                                {ep.runtime}m
                            </span>
                        )}
                    </div>
                </div>

                {formattedDate && (
                    <span className="text-[11px] text-gray-500">{formattedDate}</span>
                )}

                {hasOverview && (
                    <div className="mt-0.5">
                        <p className="text-sm text-gray-400 leading-relaxed">
                            {isLong && !expanded ? `${ep.overview.slice(0, 150).trimEnd()}…` : ep.overview}
                        </p>
                        {isLong && (
                            <button
                                onClick={() => setExpanded((v) => !v)}
                                className="mt-1 flex items-center gap-0.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {expanded ? (
                                    <>Less <ChevronUp className="size-3" /></>
                                ) : (
                                    <>More <ChevronDown className="size-3" /></>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function EpisodeGuide({ episodes, season }: EpisodeGuideProps) {
    const [showAll, setShowAll] = useState(false);
    // Show 4 rows collapsed: 3 full + the 4th partially cut by the fade
    const INITIAL_COUNT = 4;
    const needsToggle = episodes.length > INITIAL_COUNT;
    const visible = showAll ? episodes : episodes.slice(0, INITIAL_COUNT);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Episode Guide</h3>
                <span className="text-sm text-gray-400">
                    Season {season} · {episodes.length} episodes
                </span>
            </div>

            {/* List with fade overlay when collapsed */}
            <div className="relative">
                <div className="flex flex-col gap-2">
                    {visible.map((ep) => (
                        <EpisodeRow key={ep.id} ep={ep} />
                    ))}
                </div>

                {/* Fade gradient — only when collapsed and there are more episodes */}
                {needsToggle && !showAll && (
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-gray-900 to-transparent pointer-events-none" />
                )}
            </div>

            {needsToggle && (
                <button
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                    {showAll ? (
                        <>Show less <ChevronUp className="size-4" /></>
                    ) : (
                        <>Show all {episodes.length} episodes <ChevronDown className="size-4" /></>
                    )}
                </button>
            )}
        </div>
    );
}
