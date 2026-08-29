'use client';

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrailerButtonProps {
    trailer: {
        key: string;
        name: string;
    };
    className?: string;
}

export function TrailerButton({ trailer, className }: TrailerButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showVideo, setShowVideo] = useState(false);

    const handleOpen = () => {
        setIsOpen(true);
        setShowVideo(true);
    };

    const handleClose = () => {
        setShowVideo(false); // Remove iframe immediately to stop audio
        // Delay closing modal to ensure iframe is unmounted first
        setTimeout(() => setIsOpen(false), 0);
    };

    return (
        <>
            {/* A text action, not a second filled block. Stacked under the status
                button at the same height, width and weight, the two read as a pair
                of equals — but one is what you do with the show and the other is a
                video you might glance at. The hierarchy is now in the shape. */}
            <button
                onClick={handleOpen}
                className={`flex items-center gap-2 py-2 text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer ${className ?? ""}`}
            >
                <Play className="w-3.5 h-3.5 shrink-0 fill-current" />
                <span>Watch trailer</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                        onClick={handleClose}
                    >
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full max-w-5xl z-10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close button */}
                            <button
                                onClick={handleClose}
                                className="absolute -top-12 right-0 p-2 rounded-full bg-surface-4 hover:bg-surface-4 transition-colors cursor-pointer"
                            >
                                <X className="w-6 h-6 text-fg" />
                            </button>

                            {/* Video container */}
                            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/20">
                                {showVideo && (
                                    <iframe
                                        src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                                        title={trailer.name}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="absolute inset-0 w-full h-full"
                                    />
                                )}
                            </div>

                            {/* Title */}
                            <p className="mt-4 text-center text-fg-muted text-sm">{trailer.name}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
