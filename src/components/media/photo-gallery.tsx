"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
    backdrops: string[];
    posters: string[];
}

export function PhotoGallery({ backdrops, posters }: PhotoGalleryProps) {
    const [selectedImage, setSelectedImage] = useState<{ src: string; index: number; type: "backdrop" | "poster" } | null>(null);

    const allImages = [
        ...backdrops.map((src, i) => ({ src, index: i, type: "backdrop" as const })),
        ...posters.map((src, i) => ({ src, index: i, type: "poster" as const })),
    ];

    const currentIndex = selectedImage ? allImages.findIndex((img) => img.src === selectedImage.src) : -1;

    const showNext = useCallback(() => {
        if (currentIndex < allImages.length - 1) {
            setSelectedImage(allImages[currentIndex + 1]);
        } else {
            setSelectedImage(allImages[0]);
        }
    }, [currentIndex, allImages]);

    const showPrev = useCallback(() => {
        if (currentIndex > 0) {
            setSelectedImage(allImages[currentIndex - 1]);
        } else {
            setSelectedImage(allImages[allImages.length - 1]);
        }
    }, [currentIndex, allImages]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedImage) return;
            if (e.key === "ArrowRight") showNext();
            if (e.key === "ArrowLeft") showPrev();
            if (e.key === "Escape") setSelectedImage(null);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedImage, showNext, showPrev]);

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
                                onClick={() => setSelectedImage({ src, index, type: "backdrop" })}
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
                                onClick={() => setSelectedImage({ src, index, type: "poster" })}
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

            <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent
                    className="p-0 overflow-hidden border-none shadow-none focus:outline-none flex items-center justify-center rounded-none"
                    style={{ maxWidth: "80vw", width: "80vw", height: "80vh" }}
                    showCloseButton={false}
                >
                    <DialogTitle className="sr-only">Photo Preview</DialogTitle>
                    <div className="relative w-full h-full flex items-center justify-center group">
                        <AnimatePresence mode="wait">
                            {selectedImage && (
                                <motion.div
                                    key={selectedImage.src}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                                    className="relative w-full h-full max-w-[80vw] max-h-[80vh] flex items-center justify-center"
                                >
                                    <Image
                                        src={selectedImage.src}
                                        alt="Preview"
                                        fill
                                        sizes="100vw"
                                        className="object-contain drop-shadow-2xl rounded-lg"
                                        priority
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Controls */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedImage(null);
                            }}
                            className="absolute top-6 right-6 z-50 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20"
                        >
                            <X className="w-8 h-8" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                showPrev();
                            }}
                            className="absolute left-6 z-50 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 duration-300"
                        >
                            <ChevronLeft className="w-10 h-10" />
                        </button>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                showNext();
                            }}
                            className="absolute right-6 z-50 p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 duration-300"
                        >
                            <ChevronRight className="w-10 h-10" />
                        </button>

                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-sm font-medium backdrop-blur-sm">
                            {currentIndex + 1} / {allImages.length}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
