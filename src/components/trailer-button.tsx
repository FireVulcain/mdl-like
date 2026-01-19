'use client';

import { useState } from 'react';
import { Play, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TrailerButtonProps {
    trailer: {
        key: string;
        name: string;
    };
}

export function TrailerButton({ trailer }: TrailerButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
            >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <Play className="w-4 h-4 text-white fill-white" />
                </div>
                <span className="font-medium text-white">Watch Trailer</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
                        onClick={() => setIsOpen(false)}
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
                                onClick={() => setIsOpen(false)}
                                className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                            >
                                <X className="w-6 h-6 text-white" />
                            </button>

                            {/* Video container */}
                            <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10">
                                <iframe
                                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                                    title={trailer.name}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                    className="absolute inset-0 w-full h-full"
                                />
                            </div>

                            {/* Title */}
                            <p className="mt-4 text-center text-white/60 text-sm">{trailer.name}</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
