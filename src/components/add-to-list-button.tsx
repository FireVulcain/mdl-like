"use client";

import { UnifiedMedia } from "@/services/media.service";
import { Plus, Star } from "lucide-react";
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

// The status hue lives in the progress hairline only. The label stays in the
// page's ink: a tinted fill with a tinted border and tinted text was three
// coats of the same colour on one button.
const STATUS_CONFIG: Record<string, { label: string; line: string }> = {
    Watching:        { label: "Watching",      line: "bg-watching" },
    Completed:       { label: "Completed",     line: "bg-watched" },
    "Plan to Watch": { label: "Plan to Watch", line: "bg-planned" },
    Dropped:         { label: "Dropped",       line: "bg-dropped" },
    "On Hold":       { label: "On Hold",       line: "bg-onhold" },
};

// One segment of the action bar under the poster. The bar itself — its fill,
// its corners, the trailer segment beside it — belongs to the page, which
// docks it to the poster on desktop and lets it stand alone on mobile. The bar
// must be `relative`: the progress hairline is positioned against it, so it
// runs across the trailer segment too instead of stopping at this one's edge.
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
    const total = totalEp ?? userMedia?.totalEp ?? null;
    const progress = statusCfg && total
        ? userMedia.status === "Completed" ? 1 : Math.min(1, (userMedia.progress ?? 0) / total)
        : 0;

    return (
        <>
            {/* pt-0.5 is the progress hairline's height: the text centres in
                what is left under the line, not in the whole bar. */}
            {userMedia && statusCfg ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`flex flex-1 min-w-0 items-center gap-2 px-3 pt-0.5 text-sm font-medium text-fg hover:bg-surface-2 transition-colors cursor-pointer ${className ?? ""}`}
                >
                    {progress > 0 && (
                        <span className={`absolute left-0 top-0 z-10 h-0.5 ${statusCfg.line}`} style={{ width: `${progress * 100}%` }} />
                    )}
                    <span className="truncate">{statusCfg.label}</span>
                    {userMedia.score > 0 && (
                        <span className="ml-auto flex items-center gap-1 text-[13px] text-fg-soft">
                            <Star className="h-3.5 w-3.5 shrink-0 fill-current text-yellow-400" />
                            <span className="tabular-nums">{userMedia.score % 1 === 0 ? userMedia.score : userMedia.score.toFixed(1)}</span>
                        </span>
                    )}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`flex flex-1 min-w-0 items-center justify-center gap-2 px-3 pt-0.5 text-sm font-semibold text-fg hover:bg-surface-2 transition-colors cursor-pointer ${className ?? ""}`}
                >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Add to Watchlist</span>
                </button>
            )}

            {open && <EditMediaDialog open={open} onOpenChange={setOpen} item={item} media={media} season={season} totalEp={totalEp} defaultStatus={defaultStatus} />}
        </>
    );
}
