"use client";

import { useState } from "react";
import Link from "next/link";

export type GridRatings = Record<number, Record<number, number>>; // season → episode → rating

interface Props {
    mediaId: string;
    seasons: number[];
    maxEpisodes: number;
    tmdbGrid: GridRatings;
    mdlGrid?: GridRatings;
    tmdbAvg: Record<number, number | null>;
    mdlAvg?: Record<number, number | null>;
    selectedSeason: number;
}

const TIERS = [
    { label: "Awesome", min: 9.0, dot: "bg-green-800",   cell: "bg-green-800 text-white" },
    { label: "Great",   min: 8.0, dot: "bg-green-500",   cell: "bg-green-500 text-white" },
    { label: "Good",    min: 7.0, dot: "bg-yellow-500",  cell: "bg-yellow-500 text-gray-900" },
    { label: "Regular", min: 6.0, dot: "bg-orange-500",  cell: "bg-orange-500 text-white" },
    { label: "Bad",     min: 5.0, dot: "bg-red-500",     cell: "bg-red-500 text-white" },
    { label: "Garbage", min: 0,   dot: "bg-purple-600",  cell: "bg-purple-600 text-white" },
] as const;

function ratingCell(rating: number | null | undefined): string {
    if (!rating || rating <= 0) return "bg-white/5 text-gray-600";
    for (const tier of TIERS) {
        if (rating >= tier.min) return tier.cell;
    }
    return "bg-white/5 text-gray-600";
}

export function EpisodeRatingGrid({ mediaId, seasons, maxEpisodes, tmdbGrid, mdlGrid, tmdbAvg, mdlAvg, selectedSeason }: Props) {
    const hasMdl = !!mdlGrid && Object.values(mdlGrid).some((s) => Object.keys(s).length > 0);
    const hasTmdb = Object.values(tmdbGrid).some((s) => Object.keys(s).length > 0);
    const [source, setSource] = useState<"tmdb" | "mdl">(hasMdl ? "mdl" : "tmdb");

    const grid = source === "mdl" && mdlGrid ? mdlGrid : tmdbGrid;
    const avgs = source === "mdl" && mdlAvg ? mdlAvg : tmdbAvg;
    const episodes = Array.from({ length: maxEpisodes }, (_, i) => i + 1);
    const isMulti = seasons.length > 1;

    return (
        <div>
            {/* Legend + toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {TIERS.map((t) => (
                        <span key={t.label} className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${t.dot}`} />
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

            {/* Horizontal: seasons as rows, episodes as columns */}
            <div className="overflow-x-auto">
                <table className="border-separate border-spacing-1">
                    <thead>
                        <tr>
                            {isMulti && <th className="w-9" />}
                            {episodes.map((ep) => (
                                <th key={ep} className="min-w-11">
                                    <span className="block text-center text-[10px] text-gray-500 font-medium pb-0.5">E{ep}</span>
                                </th>
                            ))}
                            <th className="min-w-11">
                                <span className="block text-center text-[10px] text-gray-500 font-semibold pb-0.5">AVG</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {seasons.map((s) => (
                            <tr key={s}>
                                {isMulti && (
                                    <td className="pr-2">
                                        <Link
                                            href={`/media/${mediaId}/episodes?season=${s}`}
                                            className={`block text-center text-[11px] font-semibold py-1 rounded-lg transition-colors ${s === selectedSeason ? "bg-white/15 text-white" : "text-gray-500 hover:text-white hover:bg-white/10"}`}
                                        >
                                            S{s}
                                        </Link>
                                    </td>
                                )}
                                {episodes.map((ep) => {
                                    const rating = grid[s]?.[ep];
                                    return (
                                        <td key={ep} className="p-0">
                                            <span className={`block w-full text-center text-[11px] font-bold py-1.5 rounded-lg ${ratingCell(rating)}`}>
                                                {rating ? rating.toFixed(1) : "?"}
                                            </span>
                                        </td>
                                    );
                                })}
                                <td className="p-0">
                                    <span className={`block w-full text-center text-[11px] font-bold py-1.5 rounded-lg ${ratingCell(avgs[s])}`}>
                                        {avgs[s] ? avgs[s]!.toFixed(1) : "—"}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
