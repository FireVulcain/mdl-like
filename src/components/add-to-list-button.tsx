'use client';

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
  const item: WatchlistItem | null = userMedia ? {
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
} : null;

  return (
    <>
      {userMedia ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Pencil className="h-4 w-4" /> Edit List Entry
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add to List
        </Button>
      )}

      {open && (
        <EditMediaDialog 
            open={open} 
            onOpenChange={setOpen}
            item={item}
            media={media}
            season={season}
            totalEp={totalEp}
        />
      )}
    </>
  );
}
