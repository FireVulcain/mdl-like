"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { UnifiedMedia } from "@/services/media.service";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Textarea } from "@/components/ui/textarea";
import { deleteUserMedia, updateUserMedia, addToWatchlist, getMediaImages } from "@/actions/media";
import { Plus, Minus, Star, X, ImageIcon, Check, ZoomIn } from "lucide-react";
import { toast } from "sonner";

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
    source?: string;
    externalId?: string;
};

interface EditMediaDialogProps {
    item?: WatchlistItem | null;
    media?: UnifiedMedia;
    season?: number;
    totalEp?: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOptimisticUpdate?: (id: string, updates: Partial<WatchlistItem>, title?: string) => void;
    // Initial status when ADDING (user preference); editing always starts from the item's status
    defaultStatus?: string;
}

// The status hue is the progress hairline and nothing else, as on the media
// page's status bar: the chosen segment is told apart by its fill alone.
// A tinted fill, a tinted border, tinted text and an icon per status made the
// row a rainbow before anything was chosen.
const statusOptions = [
    { value: "Watching", label: "Watching", dot: "bg-watching" },
    { value: "Completed", label: "Completed", dot: "bg-watched" },
    { value: "Plan to Watch", label: "Plan to Watch", dot: "bg-planned" },
    { value: "Dropped", label: "Dropped", dot: "bg-dropped" },
];

export function EditMediaDialog({ item, media, season, totalEp, open, onOpenChange, onOptimisticUpdate, defaultStatus }: EditMediaDialogProps) {
    const isEditing = !!item;

    const [formData, setFormData] = useState({
        status: item?.status || defaultStatus || "Watching",
        progress: item?.progress || 0,
        score: item?.score || 0,
        notes: item?.notes || "",
    });

    const [loading, setLoading] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const [imageOptions, setImageOptions] = useState<{ posters: string[]; backdrops: string[]; mdlPosters: string[] } | null>(null);
    const [loadingImages, setLoadingImages] = useState(false);
    const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);
    const [selectedPoster, setSelectedPoster] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Only reset form when dialog opens or item ID changes, not on every item property change

    useEffect(() => {
        if (open && item) {
            setFormData({
                status: item.status || "Watching",
                progress: item.progress || 0,
                score: item.score || 0,
                notes: item.notes || "",
            });
            setSelectedBackdrop(item.backdrop || null);
            setSelectedPoster(item.poster || null);
        }
    }, [open, item?.id]);

    const editSource = isEditing ? item?.source : undefined;
    const editExternalId = isEditing ? item?.externalId : undefined;

    // Lazily fetch alternate images (TMDB + MDL) once the user opens the picker
    const loadImageOptions = async () => {
        if (!editSource || !editExternalId || loadingImages) return;
        setLoadingImages(true);
        try {
            const result = await getMediaImages(editSource, editExternalId, item?.season ?? 1);
            setImageOptions(result);
        } catch (error) {
            console.error("Failed to fetch image options", error);
            toast.error("Failed to load image options");
        } finally {
            setLoadingImages(false);
        }
    };

    const displayTitle = item?.title || media?.title || "";
    const displayYear = item?.year || media?.year || "";
    const displayPoster = selectedBackdrop || item?.poster || media?.backdrop || media?.poster || "";
    const displayTotalEp = item?.totalEp || totalEp || media?.totalEp || null;
        const progressPercent = displayTotalEp ? Math.min(100, (formData.progress / displayTotalEp) * 100) : 0;
    const statusDot = statusOptions.find((o) => o.value === formData.status)?.dot ?? "bg-watching";

    // The score is picked on a rail of whole points; the half is a toggle beside
    // it rather than a second row of ten.
    const scoreWhole = Math.floor(formData.score);
    const scoreHasHalf = formData.score % 1 !== 0;
    const pickWhole = (r: number) =>
        setFormData((prev) => {
            const half = prev.score % 1;
            if (Math.floor(prev.score) === r && !half) return { ...prev, score: 0 };
            return { ...prev, score: r === 10 ? 10 : r + half };
        });
    const toggleHalf = () =>
        setFormData((prev) => {
            const whole = Math.floor(prev.score);
            if (prev.score % 1) return { ...prev, score: whole };
            return whole >= 10 ? prev : { ...prev, score: whole + 0.5 };
        });


    const handleSave = async () => {
        setLoading(true);
        onOpenChange(false);

        const backdropChanged = isEditing && item && selectedBackdrop !== (item.backdrop || null);
        const posterChanged = isEditing && item && selectedPoster !== (item.poster || null);
        const imageUpdates = {
            ...(backdropChanged ? { backdrop: selectedBackdrop } : {}),
            ...(posterChanged ? { poster: selectedPoster } : {}),
        };

        if (isEditing && item && onOptimisticUpdate) {
            onOptimisticUpdate(item.id, {
                status: formData.status,
                progress: formData.progress,
                score: formData.score,
                notes: formData.notes,
                ...imageUpdates,
            });
        }

        try {
            if (isEditing && item) {
                await updateUserMedia(item.id, {
                    status: formData.status,
                    progress: formData.progress,
                    score: formData.score,
                    notes: formData.notes,
                    ...imageUpdates,
                });
                toast.success("Changes saved", {
                    description: displayTitle,
                });
            } else if (media) {
                await addToWatchlist(media, formData.status, season || 1, totalEp || undefined, {
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

    const handleDelete = () => {
        if (!isEditing || !item) return;
        setConfirmDelete(true);
    };

    const confirmAndDelete = async () => {
        if (!item) return;
        setLoading(true);
        setConfirmDelete(false);
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

    const handleOpenChange = (value: boolean) => {
        if (!value) setConfirmDelete(false);
        onOpenChange(value);
    };

    return (
        <>
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="max-w-lg max-h-[90vh] p-0 overflow-hidden gap-0 bg-panel border border-line-strong rounded-2xl flex flex-col shadow-2xl shadow-black/50"
                onPointerDownOutside={(e) => {
                    if ((e.target as HTMLElement)?.closest("[data-image-preview-overlay]")) {
                        e.preventDefault();
                    }
                }}
            >
                <VisuallyHidden>
                    <DialogTitle>
                        {isEditing ? "Edit" : "Add to"} Watchlist - {displayTitle}
                    </DialogTitle>
                </VisuallyHidden>

                {/* Header with Backdrop */}
                <div className="relative h-48 overflow-hidden shrink-0">
                    {displayPoster && <Image unoptimized={true} src={displayPoster} alt={displayTitle} fill className="object-cover" />}
                    <div className="absolute inset-0 bg-linear-to-t from-panel via-panel/60 to-transparent" />

                    {/* Close button */}
                    <button
                        onClick={() => handleOpenChange(false)}
                        className="cursor-pointer absolute top-3 right-3 h-8 w-8 rounded-lg bg-black/35 flex items-center justify-center text-white/75 hover:text-white hover:bg-black/55 transition-colors"
                    >
                        <X className="h-4 w-4" />
                </button>

                    <div className="absolute bottom-5 left-6 right-6">
                        <h2 className="font-display text-2xl font-bold text-fg line-clamp-2 drop-shadow-lg">{displayTitle}</h2>
                        <p className="text-sm text-fg-muted mt-1">{displayYear}</p>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                    {/* Status: one segmented rail */}
                    <div className="space-y-2">
                        <label className="text-[13px] text-fg-dim">Status</label>
                        <div className="grid grid-cols-4 gap-0.5 rounded-lg bg-surface-2 p-0.75">
                            {statusOptions.map((option) => {
                                const isSelected = formData.status === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setFormData((prev) => ({ ...prev, status: option.value }))}
                                        className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-1 py-1.5 text-[13px] transition-colors cursor-pointer ${
                                            isSelected ? "bg-surface-4 font-medium text-fg" : "text-fg-muted hover:text-fg"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Image Picker */}
                    {(editSource === "TMDB" || editSource === "MDL") && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-[13px] text-fg-dim">Images</label>
                                {!imageOptions && (
                                    <button
                                        onClick={loadImageOptions}
                                        disabled={loadingImages}
                                        className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-all disabled:opacity-50"
                                    >
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        {loadingImages ? "Loading..." : "Choose image"}
                                    </button>
                                )}
                            </div>
                            {imageOptions && (
                                <div className="space-y-4">
                                    {/* Poster - used as the thumbnail in the watchlist. MDL posters first, then TMDB alternates */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-fg-dim">Poster (list thumbnail)</p>
                                        {imageOptions.posters.length > 0 || imageOptions.mdlPosters.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {[
                                                    ...imageOptions.mdlPosters.map((url) => ({ url, isMdl: true })),
                                                    ...imageOptions.posters.map((url) => ({ url, isMdl: false })),
                                                ].map(({ url, isMdl }) => {
                                                    const isSelected = selectedPoster === url;
                                                    return (
                                                        <button
                                                            key={url}
                                                            onClick={() => setSelectedPoster(url)}
                                                            className={`group/thumb relative shrink-0 h-24 w-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                                isSelected ? "border-blue-500" : "border-transparent hover:border-line-strong"
                                                            }`}
                                                        >
                                                            <Image unoptimized src={url} alt="" fill className="object-cover" />
                                                            {isMdl && (
                                                                <span className="absolute bottom-1 left-1 rounded bg-sky-500/90 px-1 py-px text-[8px] font-bold text-white">
                                                                    MDL
                                                                </span>
                                                            )}
                                                            {isSelected && (
                                                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                                    <Check className="h-5 w-5 text-fg drop-shadow" />
                                                                </div>
                                                            )}
                                                            <span
                                                                role="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewUrl(url);
                                                                }}
                                                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                                            >
                                                                <ZoomIn className="h-3 w-3 text-fg" />
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-fg-faint">No alternate posters available.</p>
                                        )}
                                    </div>

                                    {/* Backdrop - used as this dialog's header image */}
                                    <div className="space-y-2">
                                        <p className="text-xs text-fg-dim">Backdrop (dialog header)</p>
                                        {imageOptions.backdrops.length > 0 ? (
                                            <div className="flex gap-2 overflow-x-auto pb-1">
                                                {imageOptions.backdrops.map((url) => {
                                                    const isSelected = selectedBackdrop === url;
                                                    return (
                                                        <button
                                                            key={url}
                                                            onClick={() => setSelectedBackdrop(url)}
                                                            className={`group/thumb relative shrink-0 h-16 w-28 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                                                                isSelected ? "border-blue-500" : "border-transparent hover:border-line-strong"
                                                            }`}
                                                        >
                                                            <Image unoptimized src={url} alt="" fill className="object-cover" />
                                                            {isSelected && (
                                                                <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                                                                    <Check className="h-5 w-5 text-fg drop-shadow" />
                                                                </div>
                                                            )}
                                                            <span
                                                                role="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setPreviewUrl(url);
                                                                }}
                                                                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                                            >
                                                                <ZoomIn className="h-3 w-3 text-fg" />
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-fg-faint">No alternate backdrops available.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Episodes */}
                    <div className="space-y-2">
                        <label className="text-[13px] text-fg-dim">Episodes</label>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setFormData((prev) => ({ ...prev, progress: Math.max(0, prev.progress - 1) }))}
                                aria-label="One episode less"
                                className="cursor-pointer h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-soft hover:text-fg transition-colors"
                            >
                                <Minus className="h-4 w-4" />
                            </button>

                            <div className="flex-1 space-y-1.5">
                                <p className="text-sm tabular-nums">
                                    <span className="text-base font-semibold text-fg">{formData.progress}</span>
                                    <span className="text-fg-dim"> of {displayTotalEp || "?"}</span>
                                </p>
                                <div className="h-0.75 rounded-full bg-surface-3 overflow-hidden">
                                    <div className={`h-full ${statusDot} transition-all duration-300`} style={{ width: `${progressPercent}%` }} />
                                </div>
                            </div>

                            <button
                                onClick={() => setFormData((prev) => ({ ...prev, progress: prev.progress + 1 }))}
                                aria-label="One episode more"
                                className="cursor-pointer h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-surface-3 hover:bg-surface-4 text-fg-soft hover:text-fg transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Score */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[13px] text-fg-dim">Score</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={toggleHalf}
                                    aria-pressed={scoreHasHalf}
                                    className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors ${scoreHasHalf ? "bg-surface-3 text-fg" : "text-fg-dim hover:text-fg"}`}
                                >
                                    + .5
                                </button>
                                <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                                    {formData.score > 0 ? (
                                        <>
                                            <Star className="h-3.5 w-3.5 fill-current text-yellow-400" />
                                            <span className="text-fg">{formData.score % 1 === 0 ? formData.score : formData.score.toFixed(1)}</span>
                                        </>
                                    ) : (
                                        <span className="font-normal text-fg-faint">Not rated</span>
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-10 gap-0.5 rounded-lg bg-surface-2 p-0.75">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                                <button
                                    key={rating}
                                    onClick={() => pickWhole(rating)}
                                    className={`cursor-pointer h-8 rounded-md text-[13px] tabular-nums transition-colors ${
                                        scoreWhole === rating && formData.score > 0
                                            ? "bg-fg font-semibold text-page"
                                            : formData.score > rating
                                              ? "bg-surface-3 text-fg-soft"
                                              : "text-fg-dim hover:bg-surface-3 hover:text-fg"
                                    }`}
                                >
                                    {rating}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-3">
                        <label className="text-[13px] text-fg-dim">Notes</label>
                        <Textarea
                            value={formData.notes}
                            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                            className="min-h-20 bg-surface-2 border-0 rounded-lg text-fg placeholder:text-fg-faint focus-visible:bg-surface-3 focus-visible:ring-0 resize-none"
                            placeholder="Add your thoughts..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-line-soft flex justify-between items-center shrink-0 min-h-17">
                    {confirmDelete ? (
                        <>
                            <p className="text-sm text-fg-muted">
                                Remove <span className="text-fg-soft font-medium">&ldquo;{displayTitle}&rdquo;</span>?
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="cursor-pointer h-9 px-3.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 text-sm transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmAndDelete}
                                    disabled={loading}
                                    className="cursor-pointer h-9 px-3.5 rounded-lg bg-dropped text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            {isEditing ? (
                                <button
                                    onClick={handleDelete}
                                    disabled={loading}
                                    className="cursor-pointer text-[13px] text-fg-dim hover:text-dropped transition-colors disabled:opacity-50"
                                >
                                    Remove from list
                                </button>
                            ) : (
                                <div />
                            )}
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    disabled={loading}
                                    className="cursor-pointer h-9 px-3.5 text-fg-muted hover:text-fg hover:bg-surface-2 rounded-lg"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={loading}
                                    className="cursor-pointer h-9 px-4 bg-fg hover:bg-fg/90 text-page font-semibold rounded-lg transition-colors"
                                >
                                    {loading ? "Saving…" : isEditing ? "Save" : "Add to list"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        {previewUrl && typeof document !== "undefined" && createPortal(
            <div
                data-image-preview-overlay
                className="fixed inset-0 z-100 bg-black/85 flex items-center justify-center p-8 cursor-zoom-out pointer-events-auto"
                onClick={() => setPreviewUrl(null)}
            >
                <button
                    onClick={() => setPreviewUrl(null)}
                    className="cursor-pointer absolute top-4 right-4 h-10 w-10 rounded-full bg-surface-4 hover:bg-surface-4 flex items-center justify-center text-fg transition-all"
                >
                    <X className="h-5 w-5" />
                </button>
                <Image
                    unoptimized
                    src={previewUrl}
                    alt=""
                    width={1280}
                    height={720}
                    className="max-h-[85vh] max-w-[90vw] w-auto h-auto rounded-lg object-contain shadow-2xl"
                />
            </div>,
            document.body
        )}
        </>
    );
}
