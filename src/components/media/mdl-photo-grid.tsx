"use client";

import { useState } from "react";
import Image from "next/image";
import { PhotoLightbox } from "@/components/media/photo-lightbox";
import type { KuryanaPhoto } from "@/lib/kuryana";

/**
 * MDL photos, as a grid that opens into the existing lightbox.
 *
 * The two sizes the endpoint returns are both used: the grid loads the medium
 * one, the lightbox the full one. Loading full-size files into a 200px cell
 * would cost several megabytes for a page of 28.
 *
 * Aspect ratios are mixed — stills, event shots, portraits — so cells are
 * square-cropped rather than letting each photo set its own height, which would
 * leave a ragged grid.
 */
export function MdlPhotoGrid({ photos, className = "" }: { photos: KuryanaPhoto[]; className?: string }) {
    const [openAt, setOpenAt] = useState<number | null>(null);
    if (photos.length === 0) return null;

    return (
        <>
            <div className={`grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 ${className}`}>
                {photos.map((photo, i) => (
                    <button
                        key={photo.id}
                        onClick={() => setOpenAt(i)}
                        className="cursor-pointer group relative aspect-square overflow-hidden rounded-lg bg-white/5"
                    >
                        <Image
                            unoptimized
                            src={photo.image}
                            alt=""
                            fill
                            sizes="200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                        />
                    </button>
                ))}
            </div>

            <PhotoLightbox
                images={photos.map((p) => p.image_full)}
                currentIndex={openAt ?? 0}
                open={openAt !== null}
                onClose={() => setOpenAt(null)}
                onNavigate={setOpenAt}
            />
        </>
    );
}
