"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DragScroll } from "@/components/drag-scroll";
import { PhotoLightbox } from "@/components/media/photo-lightbox";
import { SourceToggle, type MediaSource } from "@/components/media/source-toggle";
import type { KuryanaPhoto } from "@/lib/kuryana";

interface PhotosScrollProps {
    backdrops: string[];
    mdlPhotos?: KuryanaPhoto[] | null;
    mediaId: string;
    /** Carried into "View all" so it resolves the same season's MDL page. */
    season?: number;
}

// Six was a preview from a rail you could only nudge with a scrollbar. Now that
// it drags, it may as well carry what the sources actually return: MDL sends 28
// a page, and TMDB often has more than that. Every tile past the fold is
// lazy-loaded, so the ones never scrolled to are never fetched — the cap is only
// there to keep a title with a hundred backdrops from building a rail that long.
const PREVIEW_COUNT = 30;

export function PhotosScroll({ backdrops, mdlPhotos, mediaId, season }: PhotosScrollProps) {
    const hasMdl = !!mdlPhotos && mdlPhotos.length > 0;
    const hasTmdb = backdrops.length > 0;

    // MDL by default, like the cast and the recs
    const [source, setSource] = useState<MediaSource>(hasMdl ? "mdl" : "tmdb");
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (!hasMdl && !hasTmdb) return null;

    const showingMdl = source === "mdl" && hasMdl;

    // The two sources are not the same shape. TMDB backdrops are 16:9 stills;
    // MDL serves a hard 450x450 square crop for thumbnails, so dropping those
    // into the 16:9 slot would shave the top and bottom off every one of them.
    // Each source gets tiles cut to what it actually returns, at widths that
    // land on roughly the same rail height either way.
    const preview = (showingMdl ? mdlPhotos!.map((p) => p.image) : backdrops).slice(0, PREVIEW_COUNT);

    // The lightbox opens the full-size original, not the thumbnail — and it gets
    // the whole set, not just what the rail shows.
    const full = showingMdl ? mdlPhotos!.map((p) => p.image_full) : backdrops;

    const viewAllHref = showingMdl
        ? `/media/${mediaId}/photos?source=mdl${season && season > 1 ? `&season=${season}` : ""}`
        : `/media/${mediaId}/photos`;

    return (
        <div>
            {/* Same header as Cast and Recs: title on the left, controls
                gathered on the right with the toggle ahead of the link. */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-white">Photos</h3>
                <div className="flex items-center gap-3">
                    {hasMdl && hasTmdb && (
                        <SourceToggle
                            value={source}
                            // The two sets have different lengths, so a stale
                            // index would open the wrong photo — or none.
                            onChange={(next) => {
                                setLightboxIndex(null);
                                setSource(next);
                            }}
                        />
                    )}
                    <Link
                        href={viewAllHref}
                        className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium shrink-0"
                    >
                        View all →
                    </Link>
                </div>
            </div>

            {/* Click-and-drag panning, same as the rows on the home page. The
                threshold inside it is what keeps a plain click on a tile opening
                the lightbox: only a drag that actually travelled swallows the
                click that follows it. */}
            <DragScroll>
                <ScrollArea className="w-full whitespace-nowrap rounded-md" viewportStyle={{ overflowY: "hidden" }}>
                    {/* pt/px leave room for the ring, which paints outside the
                        tile: the first one starts at scroll offset 0, so its
                        left ring fell outside the viewport and was clipped, and
                        the top one was clipped on every tile. pb-4 was already
                        holding the scrollbar off the bottom edge. */}
                    <div className="flex w-max space-x-4 pt-0.5 px-0.5 pb-4">
                        {preview.map((src, index) => (
                            <button
                                key={src}
                                className={`cursor-pointer ${showingMdl ? "w-28 sm:w-40" : "w-50 sm:w-70"}`}
                                onClick={() => setLightboxIndex(index)}
                            >
                                <div
                                    className={`relative w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer group ${
                                        showingMdl ? "aspect-square" : "aspect-video"
                                    }`}
                                >
                                    <Image unoptimized={true}
                                        src={src}
                                        alt={`Photo ${index + 1}`}
                                        fill
                                        className="object-cover opacity-0 transition-all duration-700 ease-out group-hover:scale-105"
                                        loading="lazy"
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            const container = img.parentElement;
                                            setTimeout(() => {
                                                img.classList.replace("opacity-0", "opacity-100");
                                                container?.classList.remove(
                                                    "animate-shimmer",
                                                    "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                                    "bg-[length:200%_100%]"
                                                );
                                            }, 100);
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </div>
                            </button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </DragScroll>

            <PhotoLightbox
                images={full}
                currentIndex={lightboxIndex ?? 0}
                open={lightboxIndex !== null}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
            />
        </div>
    );
}
