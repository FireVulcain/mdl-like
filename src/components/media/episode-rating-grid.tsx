"use client";

import { useState } from "react";

export type GridRatings = Record<number, Record<number, number>>; // season → episode → rating

interface Props {
    mediaId: string;
    seasons: number[];
    episodesPerSeason: Record<number, number>;
    tmdbGrid: GridRatings;
    mdlGrid?: GridRatings;
    tmdbAvg: Record<number, number | null>;
    mdlAvg?: Record<number, number | null>;
    selectedSeason: number;
}

// SeriesGraph-style tiers: blue is reserved for perfect scores
const TIERS = [
    { label: "Absolute Cinema", min: 9.95, cell: "bg-sky-500 text-white", dot: "bg-sky-500" },
    { label: "Awesome", min: 9.0, cell: "bg-green-800 text-white", dot: "bg-green-800" },
    { label: "Great", min: 8.0, cell: "bg-green-500 text-white", dot: "bg-green-500" },
    { label: "Good", min: 7.0, cell: "bg-yellow-400 text-gray-900", dot: "bg-yellow-400" },
    { label: "Regular", min: 6.0, cell: "bg-orange-400 text-white", dot: "bg-orange-400" },
    { label: "Bad", min: 5.0, cell: "bg-red-500 text-white", dot: "bg-red-500" },
    { label: "Garbage", min: 0, cell: "bg-purple-600 text-white", dot: "bg-purple-600" },
] as const;

const UNRATED_CELL = "bg-gray-500/25 text-gray-400";

function ratingCell(rating: number | null | undefined): string {
    if (!rating || rating <= 0) return UNRATED_CELL;
    for (const tier of TIERS) {
        if (rating >= tier.min) return tier.cell;
    }
    return UNRATED_CELL;
}

export function EpisodeRatingGrid({ mediaId, seasons, episodesPerSeason, tmdbGrid, mdlGrid, tmdbAvg, mdlAvg, selectedSeason }: Props) {
    const hasMdl = !!mdlGrid && Object.values(mdlGrid).some((s) => Object.keys(s).length > 0);
    const hasTmdb = Object.values(tmdbGrid).some((s) => Object.keys(s).length > 0);
    const [source, setSource] = useState<"tmdb" | "mdl">(hasMdl ? "mdl" : "tmdb");

    const grid = source === "mdl" && mdlGrid ? mdlGrid : tmdbGrid;
    const avgs = source === "mdl" && mdlAvg ? mdlAvg : tmdbAvg;

    return (
        <div className="space-y-5">
            {/* Legend + source toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {TIERS.map((t) => (
                        <span key={t.label} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${t.dot}`} />
                            {t.label}
                        </span>
                    ))}
                </div>
                {hasMdl && hasTmdb && (
                    <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 gap-0.5 shrink-0">
                        <button onClick={() => setSource("mdl")} className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${source === "mdl" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}>MDL</button>
                        <button onClick={() => setSource("tmdb")} className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${source === "tmdb" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}>TMDB</button>
                    </div>
                )}
            </div>

            {/* Multi-season: one compact cell per season (the show's arc at a glance),
                then the full episode grid for the selected season only */}
            {seasons.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {seasons.map((s) => {
                        const avg = avgs[s];
                        return (
                            <a
                                key={s}
                                href={`/media/${mediaId}/episodes?season=${s}`}
                                className={`relative w-19 h-12 rounded-md transition-all hover:scale-105 ${ratingCell(avg)} ${
                                    s === selectedSeason ? "ring-2 ring-white" : "hover:ring-2 hover:ring-white/50"
                                }`}
                            >
                                <span className="absolute top-1 left-1.5 text-[10px] font-semibold opacity-70">S{s}</span>
                                <span className="absolute bottom-0.5 right-1.5 text-base font-extrabold tabular-nums">
                                    {avg ? avg.toFixed(1) : "?"}
                                </span>
                            </a>
                        );
                    })}
                </div>
            )}

            {(() => {
                const s = selectedSeason;
                const count = Math.max(1, episodesPerSeason[s] ?? 1);
                const avg = avgs[s];
                return (
                    <div>
                        <h3 className="text-base font-bold text-white">
                            Season {s}
                            {avg ? <span className="ml-2 text-sm font-normal text-gray-400">(avg {avg.toFixed(1)})</span> : null}
                        </h3>
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                            {Array.from({ length: count }, (_, i) => i + 1).map((ep) => {
                                const rating = grid[s]?.[ep];
                                return (
                                    <a
                                        key={ep}
                                        href={`#ep-${ep}`}
                                        className={`relative w-19 h-12 rounded-md transition-all hover:ring-2 hover:ring-white/50 hover:scale-105 ${ratingCell(rating)}`}
                                    >
                                        <span className="absolute top-1 left-1.5 text-[10px] font-semibold opacity-70">E{ep}</span>
                                        <span className="absolute bottom-0.5 right-1.5 text-base font-extrabold tabular-nums">
                                            {rating ? rating.toFixed(1) : "?"}
                                        </span>
                                    </a>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
