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
    // Initial status for the add dialog (user preference)
    defaultStatus?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; text: string; bg: string; border: string; hover: string }> = {
    Watching:       { label: "Watching",      icon: Eye,         text: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    hover: "hover:bg-blue-500/25" },
    Completed:      { label: "Completed",     icon: CheckCircle, text: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", hover: "hover:bg-emerald-500/25" },
    "Plan to Watch":{ label: "Plan to Watch", icon: Clock,       text: "text-slate-400",   bg: "bg-slate-500/15",   border: "border-slate-500/30",   hover: "hover:bg-slate-500/25" },
    Dropped:        { label: "Dropped",       icon: XCircle,     text: "text-rose-400",    bg: "bg-rose-500/15",    border: "border-rose-500/30",    hover: "hover:bg-rose-500/25" },
    "On Hold":      { label: "On Hold",       icon: PauseCircle, text: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   hover: "hover:bg-amber-500/25" },
};

export function AddToListButton({ media, userMedia, season, totalEp, className, defaultStatus }: AddToListButtonProps) {
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
                    // Keeps its tint: unlike the two beside it, this colour means
                    // something — it is the status itself. Only the radius comes
                    // down to the page's one value.
                    className={`h-10 px-4 gap-2 ${statusCfg.bg} border ${statusCfg.border} rounded-lg ${statusCfg.text} ${statusCfg.hover} transition-colors cursor-pointer ${className ?? ""}`}
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
                // Solid white, no gradient and no drop shadow. A two-stop gradient
                // fill under a shadow is the stock call-to-action of a generated
                // page, and the colour was a third blue on a page that already
                // spends sky on links and a state hue on the button beside it.
                // Same treatment as the Continue button on the home hero.
                <Button
                    onClick={() => setOpen(true)}
                    className={`h-10 px-4 gap-2 bg-white text-page hover:bg-white/90 rounded-lg font-semibold transition-colors cursor-pointer ${className ?? ""}`}
                >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Add to Watchlist</span>
                </Button>
            )}

            {open && <EditMediaDialog open={open} onOpenChange={setOpen} item={item} media={media} season={season} totalEp={totalEp} defaultStatus={defaultStatus} />}
        </>
    );
}
