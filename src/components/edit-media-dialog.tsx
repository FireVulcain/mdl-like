"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { UnifiedMedia } from "@/services/media.service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { deleteUserMedia, updateUserMedia, addToWatchlist } from "@/actions/media";
import { Trash2, Plus, Minus, Eye, CheckCircle, Clock, XCircle } from "lucide-react";

const MOCK_USER_ID = "mock-user-1";

export type WatchlistItem = {
    id: string;
    status: string;
    progress: number;
    score: number | null;
    notes: string | null;
    totalEp: number | null;
    title: string | null;
    poster: string | null;
    backdrop: string | null;
    year: number | null;
    originCountry: string | null;
    season?: number;
    mediaType?: string;
};

interface EditMediaDialogProps {
    item?: WatchlistItem | null;
    media?: UnifiedMedia;
    season?: number;
    totalEp?: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOptimisticUpdate?: (id: string, updates: Partial<WatchlistItem>) => void;
}

const statusOptions = [
    { value: "Watching", label: "Watching", icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { value: "Completed", label: "Completed", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    { value: "Plan to Watch", label: "Plan to Watch", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    { value: "Dropped", label: "Dropped", icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
];

export function EditMediaDialog({ item, media, season, totalEp, open, onOpenChange, onOptimisticUpdate }: EditMediaDialogProps) {
    const isEditing = !!item;

    const [formData, setFormData] = useState({
        status: item?.status || "Watching",
        progress: item?.progress || 0,
        score: item?.score || 0,
        notes: item?.notes || "",
    });

    const [loading, setLoading] = useState(false);

    // Reset form data when item changes (but only when dialog opens)
    useEffect(() => {
        if (open && item) {
            setFormData({
                status: item.status || "Watching",
                progress: item.progress || 0,
                score: item.score || 0,
                notes: item.notes || "",
            });
        }
    }, [open, item?.id]); // Only depend on open and item.id to avoid resetting during optimistic updates

    const displayTitle = item?.title || media?.title || "";
    const displayYear = item?.year || media?.year || "";
    const displayPoster = item?.backdrop || item?.poster || media?.backdrop || media?.poster || "";
    const displayTotalEp = item?.totalEp || totalEp || media?.totalEp || null;
    const progressPercent = displayTotalEp ? (formData.progress / displayTotalEp) * 100 : 0;

    const handleSave = async () => {
        setLoading(true);

        // Close the dialog first to prevent glitches
        onOpenChange(false);

        // Optimistically update the UI immediately after closing
        if (isEditing && item && onOptimisticUpdate) {
            onOptimisticUpdate(item.id, {
                status: formData.status,
                progress: formData.progress,
                score: formData.score,
                notes: formData.notes,
            });
        }

        try {
            if (isEditing && item) {
                await updateUserMedia(item.id, {
                    status: formData.status,
                    progress: formData.progress,
                    score: formData.score,
                    notes: formData.notes,
                });
            } else if (media) {
                await addToWatchlist(MOCK_USER_ID, media, formData.status, season || 1, totalEp || undefined, {
                    progress: formData.progress,
                    score: formData.score || undefined,
                    notes: formData.notes || undefined,
                });
            }
        } catch (error) {
            console.error("Failed to save", error);
            // In a production app, you might want to show an error toast here
            // and possibly revert the optimistic update
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!isEditing || !item) return;
        if (!confirm("Are you sure you want to delete this item?")) return;
        setLoading(true);
        try {
            await deleteUserMedia(item.id);
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to delete", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] p-0 overflow-hidden gap-0 bg-linear-to-br from-gray-900 to-black border border-white/10 flex flex-col">
                <VisuallyHidden>
                    <DialogTitle>
                        {isEditing ? "Edit" : "Add to"} Watchlist - {displayTitle}
                    </DialogTitle>
                </VisuallyHidden>
                <div className="absolute inset-0 -z-10">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
                </div>

                {/* Header with Backdrop */}
                <div className="relative h-48 [@media(max-height:700px)]:h-32 [@media(max-height:550px)]:h-24 overflow-hidden shrink-0">
                    {displayPoster && <Image src={displayPoster} alt={displayTitle} fill className="object-cover opacity-40" />}
                    <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />
                    <div className="absolute bottom-4 left-6">
                        <h2 className="text-2xl [@media(max-height:700px)]:text-xl [@media(max-height:550px)]:text-lg font-bold text-white">
                            {displayTitle}
                        </h2>
                        <p className="text-gray-400 [@media(max-height:700px)]:text-sm [@media(max-height:550px)]:text-xs mt-1">{displayYear}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Status Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-300">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {statusOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = formData.status === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setFormData((prev) => ({ ...prev, status: option.value }))}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                                            isSelected
                                                ? `${option.bg} ${option.border} ${option.color}`
                                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span className="text-sm font-medium">{option.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-300">Progress</label>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setFormData((prev) => ({ ...prev, progress: Math.max(0, prev.progress - 1) }))}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10"
                                >
                                    <Minus className="h-4 w-4" />
                                </button>
                                <div className="flex-1 text-center">
                                    <span className="text-2xl font-bold text-white">{formData.progress}</span>
                                    <span className="text-gray-500 mx-2">/</span>
                                    <span className="text-xl text-gray-400">{displayTotalEp || "?"}</span>
                                </div>
                                <button
                                    onClick={() => setFormData((prev) => ({ ...prev, progress: prev.progress + 1 }))}
                                    className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/10"
                                >
                                    <Plus className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="relative h-2 bg-black/30 rounded-full overflow-hidden">
                                <div
                                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                                        formData.status === "Completed"
                                            ? "bg-linear-to-r from-green-500 to-emerald-500"
                                            : "bg-linear-to-r from-blue-500 to-cyan-500"
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Rating */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-300">Rating</label>
                        <div className="space-y-2">
                            {/* Whole numbers */}
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                                    <button
                                        key={rating}
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                score: prev.score === rating ? 0 : rating,
                                            }))
                                        }
                                        className={`h-10 w-10 rounded-lg border transition-all ${
                                            formData.score === rating
                                                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500 ring-2 ring-yellow-500/30"
                                                : formData.score > rating - 1 && formData.score < rating + 1
                                                  ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                                                  : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                                        }`}
                                    >
                                        <span className="text-sm font-semibold">{rating}</span>
                                    </button>
                                ))}
                            </div>
                            {/* Half increments */}
                            <div className="flex items-center gap-2">
                                {[0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5].map((rating) => (
                                    <button
                                        key={rating}
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                score: prev.score === rating ? 0 : rating,
                                            }))
                                        }
                                        className={`h-8 w-10 rounded-lg border transition-all text-xs ${
                                            formData.score === rating
                                                ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-500 ring-2 ring-yellow-500/30"
                                                : "bg-white/5 border-white/10 text-gray-600 hover:bg-white/10 hover:text-gray-400"
                                        }`}
                                    >
                                        <span className="font-medium">{rating.toFixed(1)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {formData.score > 0 ? (
                                <>
                                    <svg className="h-5 w-5 text-yellow-500 fill-yellow-500" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                        />
                                    </svg>
                                    <span className="text-white font-semibold text-lg">{formData.score.toFixed(1)}</span>
                                    <span className="text-gray-500">/ 10</span>
                                </>
                            ) : (
                                <span className="text-gray-500 text-sm">No rating</span>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-gray-300">Notes</label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                            className="min-h-25 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:bg-white/10 focus:border-blue-500/50"
                            placeholder="Add your thoughts..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-sm flex justify-between shrink-0">
                    {isEditing ? (
                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={loading}
                            className="gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                            <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="bg-white/5 hover:bg-white/10 text-white"
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={loading} className="bg-blue-500 hover:bg-blue-600 text-white">
                            {loading ? "Saving..." : isEditing ? "Save Changes" : "Add to Watchlist"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
