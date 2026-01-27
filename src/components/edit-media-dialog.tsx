"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { UnifiedMedia } from "@/services/media.service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { deleteUserMedia, updateUserMedia, addToWatchlist } from "@/actions/media";
import { Trash2, Plus, Minus, Eye, CheckCircle, Clock, XCircle, Star, X } from "lucide-react";
import { toast } from "sonner";

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
    onOptimisticUpdate?: (id: string, updates: Partial<WatchlistItem>, title?: string) => void;
}

const statusOptions = [
    {
        value: "Watching",
        label: "Watching",
        icon: Eye,
        color: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/40",
        hoverBg: "hover:bg-blue-500/20",
    },
    {
        value: "Completed",
        label: "Completed",
        icon: CheckCircle,
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/40",
        hoverBg: "hover:bg-emerald-500/20",
    },
    {
        value: "Plan to Watch",
        label: "Plan to Watch",
        icon: Clock,
        color: "text-slate-400",
        bg: "bg-slate-500/10",
        border: "border-slate-500/40",
        hoverBg: "hover:bg-slate-500/20",
    },
    {
        value: "Dropped",
        label: "Dropped",
        icon: XCircle,
        color: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/40",
        hoverBg: "hover:bg-rose-500/20",
    },
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

    // Only reset form when dialog opens or item ID changes, not on every item property change

    useEffect(() => {
        if (open && item) {
            setFormData({
                status: item.status || "Watching",
                progress: item.progress || 0,
                score: item.score || 0,
                notes: item.notes || "",
            });
        }
    }, [open, item?.id]);

    const displayTitle = item?.title || media?.title || "";
    const displayYear = item?.year || media?.year || "";
    const displayPoster = item?.backdrop || item?.poster || media?.backdrop || media?.poster || "";
    const displayTotalEp = item?.totalEp || totalEp || media?.totalEp || null;
    const progressPercent = displayTotalEp ? (formData.progress / displayTotalEp) * 100 : 0;

    const handleSave = async () => {
        setLoading(true);
        onOpenChange(false);

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
                toast.success("Changes saved", {
                    description: displayTitle,
                });
            } else if (media) {
                await addToWatchlist(MOCK_USER_ID, media, formData.status, season || 1, totalEp || undefined, {
                    progress: formData.progress,
                    score: formData.score || undefined,
                    notes: formData.notes || undefined,
                });
                toast.success("Added to watchlist", {
                    description: displayTitle,
                });
            }
        } catch (error) {
            console.error("Failed to save", error);
            toast.error("Failed to save changes");
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
            toast.success("Removed from watchlist", {
                description: displayTitle,
            });
        } catch (error) {
            console.error("Failed to delete", error);
            toast.error("Failed to delete");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-w-lg max-h-[90vh] p-0 overflow-hidden gap-0 bg-gray-900 border border-white/10 rounded-2xl flex flex-col shadow-2xl shadow-black/50"
            >
                <VisuallyHidden>
                    <DialogTitle>
                        {isEditing ? "Edit" : "Add to"} Watchlist - {displayTitle}
                    </DialogTitle>
                </VisuallyHidden>

                {/* Header with Backdrop */}
                <div className="relative h-48 overflow-hidden shrink-0">
                    {displayPoster && <Image src={displayPoster} alt={displayTitle} fill className="object-cover" />}
                    <div className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/60 to-transparent" />

                    {/* Close button */}
                    <button
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer absolute top-4 right-4 h-9 w-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="absolute bottom-5 left-6 right-6">
                        <h2 className="text-2xl font-bold text-white line-clamp-2 drop-shadow-lg">{displayTitle}</h2>
                        <p className="text-sm text-white/60 mt-1">{displayYear}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-6 overflow-y-auto flex-1">
                    {/* Status Selection - Horizontal pills */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-400">Status</label>
                        <div className="flex flex-wrap gap-2">
                            {statusOptions.map((option) => {
                                const Icon = option.icon;
                                const isSelected = formData.status === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setFormData((prev) => ({ ...prev, status: option.value }))}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all cursor-pointer ${
                                            isSelected
                                                ? `${option.bg} ${option.border} ${option.color}`
                                                : `bg-transparent border-white/10 text-gray-500 ${option.hoverBg} hover:text-gray-300 hover:border-white/20`
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
                        <label className="text-sm font-medium text-gray-400">Progress</label>
                        <div className="flex items-center gap-5">
                            <button
                                onClick={() => setFormData((prev) => ({ ...prev, progress: Math.max(0, prev.progress - 1) }))}
                                className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
                            >
                                <Minus className="h-5 w-5" />
                            </button>

                            <div className="flex-1">
                                <div className="flex items-baseline justify-center gap-1 mb-3">
                                    <span className="text-3xl font-bold text-white tabular-nums">{formData.progress}</span>
                                    <span className="text-gray-600 text-lg">/</span>
                                    <span className="text-gray-500 text-lg tabular-nums">{displayTotalEp || "?"}</span>
                                </div>
                                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                                            formData.status === "Completed"
                                                ? "bg-linear-to-r from-emerald-500 to-emerald-400"
                                                : formData.status === "Plan to Watch"
                                                  ? "bg-linear-to-r from-slate-500 to-slate-400"
                                                  : formData.status === "Dropped"
                                                    ? "bg-linear-to-r from-rose-500 to-rose-400"
                                                    : "bg-linear-to-r from-blue-500 to-blue-400"
                                        }`}
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => setFormData((prev) => ({ ...prev, progress: prev.progress + 1 }))}
                                className="h-11 w-11 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
                            >
                                <Plus className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Rating */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-medium text-gray-400">Rating</label>
                            <div className="flex items-center gap-1.5">
                                <Star className={`h-4 w-4 ${formData.score > 0 ? "text-amber-400 fill-amber-400" : "text-gray-600"}`} />
                                <span className={`text-sm font-semibold tabular-nums ${formData.score > 0 ? "text-white" : "text-gray-600"}`}>
                                    {formData.score > 0 ? formData.score.toFixed(1) : "Not rated"}
                                </span>
                            </div>
                        </div>

                        {/* Star rating row */}
                        <div className="flex justify-between gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setFormData((prev) => ({ ...prev, score: prev.score === rating ? 0 : rating }))}
                                    className={`flex-1 h-10 rounded-lg flex items-center justify-center text-sm font-medium transition-all ${
                                        formData.score >= rating
                                            ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                                            : "bg-white/3 text-gray-600 hover:bg-white/10 hover:text-gray-400 border border-transparent"
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>

                        {/* Half points as subtle links */}
                        <div className="flex justify-center gap-3 pt-1">
                            {[0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => setFormData((prev) => ({ ...prev, score: prev.score === rating ? 0 : rating }))}
                                    className={`text-xs transition-all ${
                                        formData.score === rating ? "text-amber-400 font-medium" : "text-gray-600 hover:text-gray-400"
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-400">Notes</label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                            className="min-h-24 bg-white/3 border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:bg-white/5 focus:border-blue-500/40 resize-none"
                            placeholder="Add your thoughts..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 flex justify-between items-center shrink-0">
                    {isEditing ? (
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                        >
                            <Trash2 className="h-4 w-4" />
                            <span>Delete</span>
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                            className="h-10 px-5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="h-10 px-6 bg-blue-500 hover:bg-blue-400 text-gray-900 font-semibold rounded-xl transition-all"
                        >
                            {loading ? "Saving..." : isEditing ? "Save Changes" : "Add to List"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
