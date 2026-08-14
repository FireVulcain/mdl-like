"use client";

import { useState } from "react";
import Image from "next/image";
import { Expand } from "lucide-react";
import { PhotoLightbox } from "@/components/media/photo-lightbox";

/**
 * The poster on a media page, at full size on click.
 *
 * Drops into the existing `relative aspect-2/3` frame in place of the bare
 * <Image>, so the MDL badge stays a sibling. That ordering matters: the badge is
 * rendered after this and both are positioned, so it keeps its corner of the hit
 * area rather than disappearing under the zoom surface.
 */
export function PosterZoom({ src, alt, sizes }: { src: string; alt: string; sizes?: string }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Image unoptimized src={src} alt={alt} fill sizes={sizes} className="object-cover" priority />

            {/* Covers the poster rather than sitting in a corner: the whole
                artwork is the target, which is what a poster invites. The scrim
                and the icon are the only hint that it is clickable — on touch
                there is no hover to reveal them, but the tap works regardless. */}
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Enlarge the poster for ${alt}`}
                className="group absolute inset-0 cursor-pointer focus:outline-none"
            >
                <span className="absolute inset-0 bg-black/30 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
                <span className="absolute top-2 left-2 flex items-center justify-center p-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-white/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Expand className="size-3.5" />
                </span>
            </button>

            <PhotoLightbox
                images={[src]}
                currentIndex={0}
                open={open}
                onClose={() => setOpen(false)}
                onNavigate={() => {}}
                aspect="portrait"
            />
        </>
    );
}
