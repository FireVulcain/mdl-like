"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PhotoLightbox } from "@/components/media/photo-lightbox";

interface PhotosScrollProps {
    backdrops: string[];
    mediaId: string;
}

export function PhotosScroll({ backdrops, mediaId }: PhotosScrollProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    if (!backdrops || backdrops.length === 0) {
        return null;
    }

    const preview = backdrops.slice(0, 6);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Photos</h3>
                <Link
                    href={`/media/${mediaId}/photos`}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                    View all →
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex w-max space-x-4 pb-4">
                    {preview.map((src, index) => (
                        <button
                            key={index}
                            className="w-50 sm:w-70 cursor-pointer"
                            onClick={() => setLightboxIndex(index)}
                        >
                            <div className="relative aspect-video w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer group">
                                <Image
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

            <PhotoLightbox
                images={backdrops}
                currentIndex={lightboxIndex ?? 0}
                open={lightboxIndex !== null}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
            />
        </div>
    );
}
