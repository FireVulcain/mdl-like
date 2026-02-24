"use client";

import { Button } from "@/components/ui/button";
import { UnifiedMedia } from "@/services/media.service";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";
import { EditMediaDialog, WatchlistItem } from "@/components/edit-media-dialog";

interface AddToListButtonProps {
    media: UnifiedMedia;
    userMedia?: any;
    season: number;
    totalEp: number | null;
}

const STATUS_LABELS: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    plan_to_watch: "Plan to Watch",
    on_hold: "On Hold",
    dropped: "Dropped",
};

export function AddToListButton({ media, userMedia, season, totalEp }: AddToListButtonProps) {
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

    return (
        <>
            {userMedia ? (
                <Button
                    variant="ghost"
                    onClick={() => setOpen(true)}
                    className="h-10 px-4 gap-2 bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                >
                    <Pencil className="h-3.5 w-3.5 shrink-0" />
                    <span>{STATUS_LABELS[userMedia.status] ?? "In Watchlist"}</span>
                </Button>
            ) : (
                <Button
                    onClick={() => setOpen(true)}
                    className="h-10 px-4 gap-2 bg-linear-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl shadow-lg transition-all cursor-pointer"
                >
                    <Plus className="h-4 w-4 shrink-0" />
                    <span>Add to Watchlist</span>
                </Button>
            )}

            {open && <EditMediaDialog open={open} onOpenChange={setOpen} item={item} media={media} season={season} totalEp={totalEp} />}
        </>
    );
}
