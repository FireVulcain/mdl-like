'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UnifiedMedia } from '@/services/media.service';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea'; // Assuming you have this or standard textarea
import { deleteUserMedia, updateUserMedia, addToWatchlist } from '@/actions/media';
import { X, Pencil, Trash2, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Mock User ID
const MOCK_USER_ID = "mock-user-1"; 

export type WatchlistItem = {
  id: string; // UserMedia ID
  status: string;
  progress: number;
  score: number | null;
  notes: string | null;
  totalEp: number | null;
  // Metadata for display
  title: string | null;
  poster: string | null;
  year: number | null;
  originCountry: string | null;
  season?: number;
  mediaType?: string;
};

interface EditMediaDialogProps {
  item?: WatchlistItem | null; // Optional now
  media?: UnifiedMedia; // Required for creation if item is null
  season?: number;
  totalEp?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMediaDialog({ item, media, season, totalEp, open, onOpenChange }: EditMediaDialogProps) {
  // Determine if we are creating or editing
  const isEditing = !!item;
  
  // Initial state derived from item or defaults
  const [formData, setFormData] = useState({
    status: item?.status || "Completed",
    progress: item?.progress || 0,
    score: item?.score || 0,
    notes: item?.notes || '',
  });

  const [loading, setLoading] = useState(false);

  // Derived display info
  const displayTitle = item?.title || media?.title || '';
  const displayYear = item?.year || media?.year || '';
  const displayPoster = item?.poster || media?.poster || '';
  const displayTotalEp = item?.totalEp || totalEp || media?.totalEp || null;

  const handleSave = async () => {
    setLoading(true);
    try {
      if (isEditing && item) {
        await updateUserMedia(item.id, {
          status: formData.status,
          progress: formData.progress,
          score: formData.score,
          notes: formData.notes,
        });
      } else if (media) {
        // Create Mode
         await addToWatchlist(
            MOCK_USER_ID, 
            media, 
            formData.status, 
            season || 1, 
            totalEp || undefined, 
            {
               progress: formData.progress,
               score: formData.score || undefined,
               notes: formData.notes || undefined
            }
         );
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !item) return;
    if (!confirm('Are you sure you want to delete this item?')) return;
    setLoading(true);
    try {
      await deleteUserMedia(item.id);
      onOpenChange(false);
    } catch (error) {
        console.error('Failed to delete', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex justify-between items-center">
            <span>{displayTitle} ({displayYear})</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col md:flex-row min-h-[400px]">
           {/* Left Column: Poster & Tabs */}
           <div className="md:w-1/4 bg-muted/30 border-r p-4 space-y-4">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded shadow-sm">
                  {displayPoster ? (
                      <Image src={displayPoster} alt={displayTitle || ''} fill className="object-cover" />
                  ) : (
                      <div className="w-full h-full bg-secondary" />
                  )}
              </div>
              <div className="space-y-1">
                 <Button variant="ghost" className="w-full justify-start font-semibold bg-accent/50">General</Button>
                 <Button variant="ghost" disabled className="w-full justify-start text-muted-foreground">Advanced</Button>
                 <Button variant="ghost" disabled className="w-full justify-start text-muted-foreground">History</Button>
              </div>
           </div>

           {/* Right Column: Form */}
           <div className="md:w-3/4 p-6 space-y-6">
              
              {/* Status */}
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                 <label className="font-bold text-sm">Status</label>
                 <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                 >
                    <SelectTrigger className="w-[200px]">
                       <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                       <SelectItem value="Watching">Currently Watching</SelectItem>
                       <SelectItem value="Completed">Completed</SelectItem>
                       <SelectItem value="Plan to Watch">Plan to Watch</SelectItem>
                       <SelectItem value="On Hold">On Hold</SelectItem>
                       <SelectItem value="Dropped">Dropped</SelectItem>
                    </SelectContent>
                 </Select>
              </div>

               {/* Share Placeholder */}
               <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                 <label className="font-bold text-sm">Share</label>
                 <div className="flex gap-2">
                    <Button size="icon" variant="outline" className="rounded-full h-8 w-8"><span className="text-xs">X</span></Button>
                    <Button size="icon" variant="outline" className="rounded-full h-8 w-8"><span className="text-xs">FB</span></Button>
                 </div>
              </div>

              <hr className="border-border" />

              {/* Episodes */}
              <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                 <label className="font-bold text-sm">Episodes Watched</label>
                 <div className="flex items-center gap-3">
                    <Input 
                      type="number" 
                      min={0}
                      max={displayTotalEp || undefined}
                      value={formData.progress}
                      onChange={(e) => setFormData(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                      className="w-20"
                    />
                    <div className="text-sm">
                        / {displayTotalEp || '?'}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setFormData(prev => ({ ...prev, progress: prev.progress + 1 }))}>+</Button>
                 </div>
              </div>

              <hr className="border-border" />

               {/* Overall Rating */}
               <div className="grid grid-cols-[120px_1fr] items-center gap-4">
                 <label className="font-bold text-sm">Overall Rating</label>
                 <div className="flex items-center gap-4">
                     <Select 
                        value={formData.score?.toString() || "0"} 
                        onValueChange={(v) => setFormData(prev => ({ ...prev, score: parseFloat(v) }))}
                    >
                        <SelectTrigger className="w-[80px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">--</SelectItem>
                            {Array.from({ length: 20 }, (_, i) => {
                                const val = (10 - i * 0.5);
                                return <SelectItem key={val} value={val.toString()}>{val.toFixed(1)}</SelectItem>
                            })}
                        </SelectContent>
                    </Select>
                    <div className="text-sm">
                        <strong>{formData.score?.toFixed(1) || '0.0'}</strong> / 10
                    </div>
                 </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-[120px_1fr] gap-4">
                 <label className="font-bold text-sm pt-2">Notes</label>
                 <Textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="min-h-[100px]"
                    placeholder="Add your notes..."
                 />
              </div>

           </div>
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 flex justify-between sm:justify-between w-full">
            {isEditing ? (
              <Button variant="destructive" onClick={handleDelete} disabled={loading} className="gap-2">
                 <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <div></div> // Spacer
            )}
            <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
                <Button onClick={handleSave} disabled={loading}>Submit</Button>
            </div>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
