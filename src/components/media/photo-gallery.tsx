"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { PhotoLightbox } from "@/components/media/photo-lightbox";

interface PhotoGalleryProps {
    backdrops: string[];
    posters: string[];
}

export function PhotoGallery({ backdrops, posters }: PhotoGalleryProps) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    const allImages = [
        ...backdrops,
        ...posters,
    ];

    return (
        <div className="space-y-12">
            {/* Backdrops Section */}
            {backdrops.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">Backdrops</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {backdrops.map((src, index) => (
                            <motion.div
                                key={`backdrop-${index}`}
                                layoutId={`image-${src}`}
                                className="relative aspect-video w-full overflow-hidden rounded-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer shadow-lg group cursor-pointer ring-2 ring-white/10 hover:ring-white/20 transition-all"
                                onClick={() => setLightboxIndex(index)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Image
                                    src={src}
                                    alt={`Backdrop ${index + 1}`}
                                    fill
                                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                                    className="object-cover transition-all duration-700 group-hover:scale-110 opacity-0"
                                    loading="lazy"
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        const container = img.parentElement;
                                        setTimeout(() => {
                                            img.classList.replace("opacity-0", "opacity-100");
                                            container?.classList.remove(
                                                "animate-shimmer",
                                                "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                                "bg-size-[200%_100%]"
                                            );
                                        }, 100);
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Posters Section */}
            {posters.length > 0 && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">Posters</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {posters.map((src, index) => (
                            <motion.div
                                key={`poster-${index}`}
                                layoutId={`image-${src}`}
                                className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer shadow-lg group cursor-pointer ring-2 ring-white/10 hover:ring-white/20 transition-all"
                                onClick={() => setLightboxIndex(backdrops.length + index)}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Image
                                    src={src}
                                    alt={`Poster ${index + 1}`}
                                    fill
                                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                                    className="object-cover transition-all duration-700 group-hover:scale-110 opacity-0"
                                    loading="lazy"
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        const container = img.parentElement;
                                        setTimeout(() => {
                                            img.classList.replace("opacity-0", "opacity-100");
                                            container?.classList.remove(
                                                "animate-shimmer",
                                                "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                                "bg-size-[200%_100%]"
                                            );
                                        }, 100);
                                    }}
                                />
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            <PhotoLightbox
                images={allImages}
                currentIndex={lightboxIndex ?? 0}
                open={lightboxIndex !== null}
                onClose={() => setLightboxIndex(null)}
                onNavigate={setLightboxIndex}
            />
        </div>
    );
}
