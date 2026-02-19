"use client";

import { useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface PhotoLightboxProps {
    images: string[];
    currentIndex: number;
    open: boolean;
    onClose: () => void;
    onNavigate: (index: number) => void;
}

export function PhotoLightbox({ images, currentIndex, open, onClose, onNavigate }: PhotoLightboxProps) {
    const showNext = useCallback(() => {
        onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
    }, [currentIndex, images.length, onNavigate]);

    const showPrev = useCallback(() => {
        onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
    }, [currentIndex, images.length, onNavigate]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") showNext();
            if (e.key === "ArrowLeft") showPrev();
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, showNext, showPrev, onClose]);

    const src = images[currentIndex];

    return (
        <Dialog open={open} onOpenChange={() => onClose()}>
            <DialogContent
                className="p-0 overflow-hidden border-none shadow-none focus:outline-none flex items-center justify-center rounded-none"
                style={{ maxWidth: "80vw", width: "80vw", height: "80vh" }}
                showCloseButton={false}
            >
                <DialogTitle className="sr-only">Photo Preview</DialogTitle>
                <div className="relative w-full h-full flex items-center justify-center group">
                    <AnimatePresence mode="wait">
                        {src && (
                            <motion.div
                                key={src}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                                className="relative w-full h-full flex items-center justify-center"
                            >
                                <Image
                                    src={src}
                                    alt="Preview"
                                    fill
                                    sizes="100vw"
                                    className="object-contain drop-shadow-2xl rounded-lg"
                                    priority
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="absolute top-6 right-8 z-50 cursor-pointer p-1.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); showPrev(); }}
                        className="absolute left-8 z-50 cursor-pointer p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 duration-300"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); showNext(); }}
                        className="absolute right-8 z-50 cursor-pointer p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors backdrop-blur-md border border-white/20 opacity-0 group-hover:opacity-100 duration-300"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/50 text-white text-sm font-medium backdrop-blur-sm">
                        {currentIndex + 1} / {images.length}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
