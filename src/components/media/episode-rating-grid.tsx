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
    { label: "Awesome", min: 9.0, dot: "bg-green-800",  cell: "bg-green-800 text-white" },
    { label: "Great",   min: 8.0, dot: "bg-green-500",  cell: "bg-green-500 text-white" },
    { label: "Good",    min: 7.0, dot: "bg-yellow-400", cell: "bg-yellow-400 text-gray-900" },
    { label: "Regular", min: 6.0, dot: "bg-orange-400", cell: "bg-orange-400 text-white" },
    { label: "Bad",     min: 5.0, dot: "bg-red-500",    cell: "bg-red-500 text-white" },
    { label: "Garbage", min: 0,   dot: "bg-purple-600", cell: "bg-purple-600 text-white" },
] as const;

function ratingCell(rating: number | null | undefined): string {
    if (!rating || rating <= 0) return "bg-white/8 text-gray-500";
    for (const tier of TIERS) {
        if (rating >= tier.min) return tier.cell;
    }
    return "bg-white/8 text-gray-500";
}

export function EpisodeRatingGrid({ mediaId, seasons, maxEpisodes, tmdbGrid, mdlGrid, tmdbAvg, mdlAvg, selectedSeason }: Props) {
    const hasMdl = !!mdlGrid && Object.values(mdlGrid).some((s) => Object.keys(s).length > 0);
    const hasTmdb = Object.values(tmdbGrid).some((s) => Object.keys(s).length > 0);
    const [source, setSource] = useState<"tmdb" | "mdl">(hasMdl ? "mdl" : "tmdb");
    const [inverted, setInverted] = useState(false);

    const grid = source === "mdl" && mdlGrid ? mdlGrid : tmdbGrid;
    const avgs = source === "mdl" && mdlAvg ? mdlAvg : tmdbAvg;
    const episodes = Array.from({ length: maxEpisodes }, (_, i) => i + 1);
    const isMulti = seasons.length > 1;

    return (
        <div>
            {/* Legend + toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {TIERS.map((t) => (
                        <span key={t.label} className="flex items-center gap-1.5 text-xs text-gray-400">
                            <span className={`inline-block w-3 h-3 rounded-sm ${t.dot}`} />
                            {t.label}
                        </span>
                    ))}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-gray-400">Inverted</span>
                        <button
                            role="switch"
                            aria-checked={inverted}
                            onClick={() => setInverted((v) => !v)}
                            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${inverted ? "bg-white/30" : "bg-white/10"}`}
                        >
                            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${inverted ? "translate-x-4" : "translate-x-0"}`} />
                        </button>
                    </label>
                    {hasMdl && hasTmdb && (
                        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 gap-0.5">
                            <button onClick={() => setSource("mdl")} className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${source === "mdl" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}>MDL</button>
                            <button onClick={() => setSource("tmdb")} className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${source === "tmdb" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"}`}>TMDB</button>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="border-separate border-spacing-1">
                    {!inverted ? (
                        /* Default: seasons as rows, episodes as columns */
                        <>
                            <thead>
                                <tr>
                                    {isMulti && <th className="w-12" />}
                                    {episodes.map((ep) => (
                                        <th key={ep} className="min-w-13">
                                            <span className="block text-center text-xs text-gray-500 font-medium pb-1">E{ep}</span>
                                        </th>
                                    ))}
                                    <th className="min-w-13">
                                        <span className="block text-center text-xs text-gray-500 font-semibold pb-1">AVG.</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {seasons.map((s) => (
                                    <tr key={s}>
                                        {isMulti && (
                                            <td className="pr-2 text-right">
                                                <Link href={`/media/${mediaId}/episodes?season=${s}`} className={`text-sm font-semibold transition-colors ${s === selectedSeason ? "text-white" : "text-gray-500 hover:text-white"}`}>
                                                    S{s}
                                                </Link>
                                            </td>
                                        )}
                                        {episodes.map((ep) => {
                                            const rating = grid[s]?.[ep];
                                            return (
                                                <td key={ep} className="p-0">
                                                    <span className={`block w-full text-center text-sm font-bold py-2 rounded-md ${ratingCell(rating)}`}>
                                                        {rating ? rating.toFixed(1) : "?"}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td className="p-0">
                                            <span className={`block w-full text-center text-sm font-bold py-2 rounded-md underline underline-offset-2 decoration-white/30 ${ratingCell(avgs[s])}`}>
                                                {avgs[s] ? avgs[s]!.toFixed(1) : "—"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </>
                    ) : (
                        /* Inverted: episodes as rows, seasons as columns */
                        <>
                            <thead>
                                <tr>
                                    <th className="w-9" />
                                    {seasons.map((s) => (
                                        <th key={s} className="min-w-13">
                                            <Link href={`/media/${mediaId}/episodes?season=${s}`} className={`block text-center text-xs font-semibold pb-1 transition-colors ${s === selectedSeason ? "text-white" : "text-gray-500 hover:text-white"}`}>
                                                S{s}
                                            </Link>
                                        </th>
                                    ))}
                                    <th className="min-w-13">
                                        <span className="block text-center text-xs text-gray-500 font-semibold pb-1">AVG.</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {episodes.map((ep) => {
                                    const epAvg = seasons.reduce((sum, s) => {
                                        const r = grid[s]?.[ep];
                                        return r ? { sum: sum.sum + r, count: sum.count + 1 } : sum;
                                    }, { sum: 0, count: 0 });
                                    const epAvgVal = epAvg.count > 0 ? epAvg.sum / epAvg.count : null;
                                    return (
                                        <tr key={ep}>
                                            <td className="text-right pr-2">
                                                <span className="text-xs text-gray-500 font-medium">E{ep}</span>
                                            </td>
                                            {seasons.map((s) => {
                                                const rating = grid[s]?.[ep];
                                                return (
                                                    <td key={s} className="p-0">
                                                        <span className={`block w-full text-center text-sm font-bold py-2 rounded-md ${ratingCell(rating)}`}>
                                                            {rating ? rating.toFixed(1) : "?"}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                            <td className="p-0">
                                                <span className={`block w-full text-center text-sm font-bold py-2 rounded-md underline underline-offset-2 decoration-white/30 ${ratingCell(epAvgVal)}`}>
                                                    {epAvgVal ? epAvgVal.toFixed(1) : "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </>
                    )}
                </table>
            </div>
        </div>
    );
}
