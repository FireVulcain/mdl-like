"use client";

import { Button } from "@/components/ui/button";
import { UnifiedMedia } from "@/services/media.service";
import { Plus, Check, Pencil } from "lucide-react";
import { useState } from "react";
import { EditMediaDialog, WatchlistItem } from "@/components/edit-media-dialog";

interface AddToListButtonProps {
    media: UnifiedMedia;
    userMedia?: any; // We accept the full object now
    season: number;
    totalEp: number | null;
}

export function AddToListButton({ media, userMedia, season, totalEp }: AddToListButtonProps) {
    const [open, setOpen] = useState(false);

    // Transform userMedia to WatchlistItem if it exists
    const item: WatchlistItem | null = userMedia
        ? {
              id: userMedia.id,
              title: userMedia.title,
              poster: userMedia.poster,
              backdrop: userMedia.backdrop || null, // Add this line
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
                <div className="relative group">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setOpen(true)}
                        className="h-10 w-10 bg-white/10 border border-white/10 rounded-xl text-gray-300 hover:text-white hover:bg-white/15 transition-all cursor-pointer"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        Edit in Watchlist
                    </span>
                </div>
            ) : (
                <div className="relative group">
                    <Button
                        onClick={() => setOpen(true)}
                        size="icon"
                        className="h-10 w-10 bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white rounded-xl shadow-lg transition-all cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                    <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                        Add to Watchlist
                    </span>
                </div>
            )}

            {open && <EditMediaDialog open={open} onOpenChange={setOpen} item={item} media={media} season={season} totalEp={totalEp} />}
        </>
    );
}
