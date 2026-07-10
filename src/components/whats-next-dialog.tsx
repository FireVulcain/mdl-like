"use client";

import Link from "next/link";
import Image from "next/image";
import { Sparkles, ImageOff, ArrowDownWideNarrow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RecommendationsPayload } from "@/actions/recommendations";

interface WhatsNextDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payload: RecommendationsPayload | null;
    loading: boolean;
    onSortByMatch: () => void;
}

const RANK_STYLES = [
    "bg-amber-400/20 text-amber-300",
    "bg-gray-300/15 text-gray-300",
    "bg-orange-700/25 text-orange-400",
    "bg-white/8 text-gray-400",
    "bg-white/8 text-gray-400",
];

function matchColor(score: number): string {
    if (score >= 75) return "text-emerald-400";
    if (score >= 55) return "text-blue-400";
    if (score >= 35) return "text-amber-400";
    return "text-gray-400";
}

export function WhatsNextDialog({ open, onOpenChange, payload, loading, onSortByMatch }: WhatsNextDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl bg-gray-900 border-white/10">
                <DialogHeader>
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        What to watch next
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Your best Plan to Watch matches, based on what you&apos;ve watched and rated.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="space-y-2 py-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-white/3 animate-pulse">
                                <div className="w-12 h-[68px] rounded-lg bg-white/10 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-2/5 rounded bg-white/10" />
                                    <div className="h-3 w-3/5 rounded bg-white/5" />
                                </div>
                                <div className="h-6 w-12 rounded bg-white/10 shrink-0" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && payload && payload.topPicks.length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-500">
                        Nothing to recommend — add some shows to Plan to Watch first.
                    </div>
                )}

                {!loading && payload && payload.topPicks.length > 0 && (
                    <div className="space-y-2 py-1 max-h-[60vh] overflow-y-auto">
                        {payload.topPicks.map((pick, idx) => (
                            <Link
                                key={pick.id}
                                href={`/media/${pick.source.toLowerCase()}-${pick.externalId}${pick.season > 1 ? `?season=${pick.season}` : ""}`}
                                className="flex items-center gap-3 p-2 rounded-xl bg-white/3 border border-white/5 hover:bg-white/8 hover:border-white/10 transition-all group"
                            >
                                <span
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${RANK_STYLES[idx] ?? RANK_STYLES[4]}`}
                                >
                                    {idx + 1}
                                </span>
                                <div className="relative w-12 h-[68px] rounded-lg overflow-hidden bg-gray-800 shrink-0">
                                    {pick.poster ? (
                                        <Image
                                            unoptimized
                                            src={pick.poster}
                                            alt={pick.title ?? ""}
                                            fill
                                            sizes="48px"
                                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                            <ImageOff className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm text-white line-clamp-1 group-hover:text-violet-300 transition-colors">
                                            {pick.title}
                                        </span>
                                        {pick.season > 1 && (
                                            <span className="text-[10px] font-medium text-gray-400 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                                                S{pick.season}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-1">{pick.year ?? ""}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {pick.reasons.slice(0, 3).map((reason) => (
                                            <span
                                                key={reason}
                                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-300/90 border border-violet-500/15"
                                            >
                                                {reason}
                                            </span>
                                        ))}
                                        {pick.reasons.length === 0 && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500">
                                                Matches your overall taste
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={`text-lg font-bold shrink-0 ${matchColor(pick.score)}`}>
                                    {pick.score}
                                    <span className="text-[10px] font-medium opacity-60">%</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}

                {!loading && payload && payload.watchedCount < 5 && payload.topPicks.length > 0 && (
                    <p className="text-xs text-gray-500">
                        Based on only {payload.watchedCount} watched {payload.watchedCount === 1 ? "title" : "titles"} — matches
                        will get sharper as you watch and rate more.
                    </p>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer text-gray-400 hover:text-white hover:bg-white/10"
                    >
                        Close
                    </Button>
                    {payload && payload.topPicks.length > 0 && (
                        <Button
                            onClick={onSortByMatch}
                            className="cursor-pointer bg-violet-600 hover:bg-violet-700 text-white"
                        >
                            <ArrowDownWideNarrow className="h-4 w-4" />
                            Sort watchlist by match
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
