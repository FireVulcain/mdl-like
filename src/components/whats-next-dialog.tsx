"use client";

import Link from "next/link";
import Image from "next/image";
import { ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RecommendationPick, RecommendationsPayload } from "@/actions/recommendations";

interface WhatsNextDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    payload: RecommendationsPayload | null;
    loading: boolean;
    onSortByMatch: () => void;
    onDismiss: (pick: RecommendationPick) => void;
}

// The engine's reasons, cut to what a single line needs: "Romance & Drama
// match your top genres" reads as "Romance & Drama" once it sits in a run
// under the title. The full sentences stay in the line's tooltip.
function shortReason(reason: string): string {
    return reason
        .replace(/ match(?:es)? your top genres$/, "")
        .replace(/^Themes you love: /, "")
        .replace(/^Stars (.+) from shows you watched$/, "With $1")
        .replace(/^From (.+), whose work you've watched$/, "From $1");
}

export function WhatsNextDialog({ open, onOpenChange, payload, loading, onSortByMatch, onDismiss }: WhatsNextDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl bg-panel border-line-strong">
                <DialogHeader>
                    <DialogTitle className="text-fg">What to watch next</DialogTitle>
                    <DialogDescription className="text-[13px] text-fg-dim">
                        Your best Plan to Watch matches, from what you&apos;ve watched and rated.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <div className="divide-y divide-line-soft py-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 px-2 py-2.5 animate-pulse">
                                <div className="w-4 shrink-0" />
                                <div className="w-10 h-14 rounded-md bg-surface-3 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 w-2/5 rounded bg-surface-3" />
                                    <div className="h-3 w-3/5 rounded bg-surface-2" />
                                </div>
                                <div className="h-5 w-10 rounded bg-surface-3 shrink-0" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && payload && payload.topPicks.length === 0 && (
                    <div className="py-8 text-center text-sm text-fg-dim">
                        Nothing to recommend — add some shows to Plan to Watch first.
                    </div>
                )}

                {/* Rows under hairlines, as in the media page's info box: no card,
                    no medal colours on the rank, no tinted chips. The reasons are
                    the point of this dialog, so every row keeps them, as one line
                    of plain text. */}
                {!loading && payload && payload.topPicks.length > 0 && (
                    <div className="divide-y divide-line-soft max-h-[60vh] overflow-y-auto -mx-2">
                        {payload.topPicks.map((pick, idx) => (
                            <Link
                                key={pick.id}
                                href={`/media/${pick.source.toLowerCase()}-${pick.externalId}${pick.season > 1 ? `?season=${pick.season}` : ""}`}
                                className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
                            >
                                <span className="w-4 shrink-0 text-right text-[13px] tabular-nums text-fg-faint">{idx + 1}</span>
                                <div className="relative w-10 h-14 rounded-md overflow-hidden bg-surface-3 shrink-0">
                                    {pick.poster ? (
                                        <Image unoptimized src={pick.poster} alt={pick.title ?? ""} fill sizes="40px" className="object-cover" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                                            <ImageOff className="h-4 w-4" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="font-semibold text-sm text-fg truncate">{pick.title}</span>
                                        {pick.season > 1 && <span className="text-[13px] text-fg-dim shrink-0">S{pick.season}</span>}
                                        {pick.year && <span className="text-[13px] text-fg-dim shrink-0">{pick.year}</span>}
                                    </div>
                                    <p
                                        className="mt-0.5 text-[13px] text-fg-muted line-clamp-2"
                                        title={pick.reasons.length > 0 ? pick.reasons.join("\n") : undefined}
                                    >
                                        {pick.reasons.length > 0
                                            ? pick.reasons.slice(0, 3).map(shortReason).join(" · ")
                                            : "Matches your overall taste"}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right text-[13px] leading-tight text-fg-dim">
                                    <span className="block text-[17px] font-semibold text-fg tabular-nums">{pick.score}%</span>
                                    match
                                </div>
                                <TooltipProvider delayDuration={300}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    onDismiss(pick);
                                                }}
                                                className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-fg-faint hover:text-fg hover:bg-surface-3 transition-colors cursor-pointer"
                                                aria-label="Not interested"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left">Not interested</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </Link>
                        ))}
                    </div>
                )}

                {!loading && payload && payload.watchedCount < 5 && payload.topPicks.length > 0 && (
                    <p className="text-xs text-fg-dim">
                        Based on only {payload.watchedCount} watched {payload.watchedCount === 1 ? "title" : "titles"} — matches
                        will get sharper as you watch and rate more.
                    </p>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer h-9 text-fg-muted hover:text-fg hover:bg-surface-2"
                    >
                        Close
                    </Button>
                    {payload && payload.topPicks.length > 0 && (
                        <Button onClick={onSortByMatch} className="cursor-pointer h-9 bg-fg hover:bg-fg/90 text-page font-semibold">
                            Sort watchlist by match
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
