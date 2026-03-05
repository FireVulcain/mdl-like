"use client";

import { Button } from "@/components/ui/button";
import { UnifiedMedia } from "@/services/media.service";
import { Plus, Eye, CheckCircle, Clock, XCircle, PauseCircle, Star } from "lucide-react";
import { useState } from "react";
import { EditMediaDialog, WatchlistItem } from "@/components/edit-media-dialog";

interface AddToListButtonProps {
    media: UnifiedMedia;
    userMedia?: any;
    season: number;
    totalEp: number | null;
    className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; text: string; bg: string; border: string; hover: string }> = {
    Watching:       { label: "Watching",      icon: Eye,         text: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    hover: "hover:bg-blue-500/25" },
    Completed:      { label: "Completed",     icon: CheckCircle, text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", hover: "hover:bg-emerald-500/25" },
    "Plan to Watch":{ label: "Plan to Watch", icon: Clock,       text: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-500/30",   hover: "hover:bg-slate-500/25" },
    Dropped:        { label: "Dropped",       icon: XCircle,     text: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/30",    hover: "hover:bg-rose-500/25" },
    "On Hold":      { label: "On Hold",       icon: PauseCircle, text: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   hover: "hover:bg-amber-500/25" },
};

export function AddToListButton({ media, userMedia, season, totalEp, className }: AddToListButtonProps) {
    const [open, setOpen] = useState(false);

    const item: WatchlistItem | null = userMedia
        ? {
              id: userMedia.id,
              title: userMedia.title,
              poster: userMedia.poster,
              backdrop: userMedia.backdrop || null,
              year: userMedia.year,
              originCountry: userMedia.originCountry,
              status: userMedia.status,
              progress: userMedia.progress,
              totalEp: userMedia.totalEp,
              score: userMedia.score,
              notes: userMedia.notes,
              season: userMedia.season,
              mediaType: userMedia.mediaType,
          }
        : null;

    const statusCfg = userMedia ? (STATUS_CONFIG[userMedia.status] ?? null) : null;
    const StatusIcon = statusCfg?.icon;

    return (
        <>
            {userMedia && statusCfg ? (
                <Button
                    variant="ghost"
                    onClick={() => setOpen(true)}
                    className={`h-10 px-4 gap-2 ${statusCfg.bg} border ${statusCfg.border} rounded-xl ${statusCfg.text} ${statusCfg.hover} transition-all cursor-pointer ${className ?? ""}`}
                >
                    {StatusIcon && <StatusIcon className="h-4 w-4 shrink-0" />}
                    <span>{statusCfg.label}</span>
                    {userMedia.score > 0 && (
                        <>
                            <span className="opacity-30 mx-0.5">|</span>
                            <Star className="h-3.5 w-3.5 shrink-0 fill-current opacity-80" />
                            <span className="font-semibold tabular-nums">{userMedia.score % 1 === 0 ? userMedia.score : userMedia.score.toFixed(1)}</span>
                        </>
                    )}
                </Button>
            ) : (
                <Button
                    onClick={() => setOpen(true)}
                    className={`h-10 px-4 gap-2 bg-linear-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl shadow-lg transition-all cursor-pointer ${className ?? ""}`}
                >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Add to Watchlist</span>
                </Button>
            )}

            {open && <EditMediaDialog open={open} onOpenChange={setOpen} item={item} media={media} season={season} totalEp={totalEp} />}
        </>
    );
}
