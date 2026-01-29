"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ChevronRight, ChevronLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ContinueWatchingItem {
    id: string;
    title: string | null;
    poster: string;
    backdrop?: string | null;
    progress: number;
    totalEp: number;
    externalId: string;
    source: string;
}

interface ContinueWatchingProps {
    items: ContinueWatchingItem[];
}

export function ContinueWatching({ items }: ContinueWatchingProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    const selectedShow = items[selectedIndex];

    // Auto-advancement
    useEffect(() => {
        if (items.length <= 1 || isPaused) return;

        const interval = setInterval(() => {
            setSelectedIndex((prev) => (prev + 1) % items.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [items.length, isPaused]);

    const handleSelect = useCallback((index: number) => {
        setSelectedIndex(index);
        setIsPaused(true);
        // Resume auto-play after 10 seconds of inactivity
        setTimeout(() => setIsPaused(false), 10000);
    }, []);

    if (items.length === 0) return null;

    const progressPercent = (selectedShow.progress / selectedShow.totalEp) * 100;

    return (
        <section
            className="relative h-[90vh] min-h-125 -mt-24 w-full overflow-hidden"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            {/* Backdrop with crossfade */}
            <AnimatePresence mode="popLayout">
                <motion.div
                    key={selectedShow.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.7 }}
                    className="absolute inset-0"
                >
                    {(selectedShow.backdrop || selectedShow.poster) && (
                        <Image
                            src={selectedShow.backdrop || selectedShow.poster}
                            alt={selectedShow.title ?? ""}
                            fill
                            priority
                            sizes="100vw"
                            quality={90}
                            className="object-cover object-top"
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-linear-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/30" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-[#0a0a0f]" />

            {/* Content */}
            <div className="relative h-full flex">
                {/* Left side - Show info */}
                <div className="flex-1 flex flex-col justify-end pb-16 md:pb-24 pl-[5%] md:pl-[7.5%]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={selectedShow.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.4 }}
                            className="max-w-xl space-y-4 md:space-y-6"
                        >
                            {/* Badge */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                                    <Play className="h-3 w-3 text-blue-400 fill-blue-400" />
                                    <span className="text-xs font-medium text-blue-300">Continue Watching</span>
                                </div>
                            </div>

                            {/* Title */}
                            <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                                {selectedShow.title}
                            </h2>

                            {/* Progress info */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-4 text-sm md:text-base text-gray-300">
                                    <span>
                                        Episode {selectedShow.progress} of {selectedShow.totalEp}
                                    </span>
                                    <span className="text-gray-600">|</span>
                                    <span className="text-blue-400">{Math.round(progressPercent)}% complete</span>
                                </div>

                                {/* Progress bar */}
                                <div className="relative h-1.5 w-64 md:w-80 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-500 to-blue-400 rounded-full"
                                    />
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex items-center gap-4 pt-2">
                                <Link
                                    href={`/media/${selectedShow.source.toLowerCase()}-${selectedShow.externalId}`}
                                    className="group flex items-center gap-3 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-xl transition-all"
                                >
                                    <Play className="h-5 w-5 fill-current" />
                                    <span>Continue</span>
                                </Link>
                                <Link
                                    href="/watchlist"
                                    className="flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all border border-white/10"
                                >
                                    <span>View Watchlist</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Right side - Horizontal carousel at screen edge */}
                <div className="hidden md:flex absolute right-0 bottom-24 items-center">
                    {/* Navigation arrow - always visible for infinite scroll */}
                    <button
                        onClick={() => handleSelect((selectedIndex - 1 + items.length) % items.length)}
                        className="cursor-pointer absolute -left-14 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 transition-all"
                    >
                        <ChevronLeft className="h-5 w-5 text-white" />
                    </button>

                    {/* Carousel container - shows 2.5 cards with padding for ring */}
                    <div className="overflow-hidden pl-2 py-2" style={{ width: "calc(2.5 * 200px + 2 * 16px + 8px)" }}>
                        <motion.div
                            className="flex gap-4 pl-1"
                            animate={{ x: -selectedIndex * (200 + 16) }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            {/* Render items twice for infinite scroll illusion */}
                            {[...items, ...items].map((show, index) => {
                                const actualIndex = index % items.length;
                                const isSelected = actualIndex === selectedIndex;
                                const showProgress = (show.progress / show.totalEp) * 100;

                                return (
                                    <motion.button
                                        key={`${show.id}-${index}`}
                                        onClick={() => handleSelect(actualIndex)}
                                        whileHover={{ scale: 1.03 }}
                                        className={`relative shrink-0 w-50 h-32.5 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                                            isSelected ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-[#0a0a0f]" : "opacity-60 hover:opacity-100"
                                        }`}
                                    >
                                        <Image src={show.backdrop || show.poster} alt={show.title ?? ""} fill className="object-cover" />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                                        {/* Title overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 p-2">
                                            <p className="text-white text-xs font-medium line-clamp-1">{show.title}</p>
                                            {isSelected && (
                                                <div className="mt-1 relative h-0.5 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                                                        style={{ width: `${showProgress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <motion.div
                                                layoutId="selectedIndicator"
                                                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500"
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                            />
                                        )}
                                    </motion.button>
                                );
                            })}
                        </motion.div>
                    </div>
                </div>

                {/* Mobile: Bottom dots indicator */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 md:hidden">
                    {items.slice(0, 5).map((_, index) => (
                        <button
                            key={index}
                            onClick={() => handleSelect(index)}
                            className={`transition-all duration-300 rounded-full ${
                                index === selectedIndex ? "w-6 h-2 bg-blue-500" : "w-2 h-2 bg-white/30 hover:bg-white/50"
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Auto-advance progress indicator */}
            {!isPaused && items.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                    <motion.div
                        key={selectedIndex}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 5, ease: "linear" }}
                        className="h-full bg-blue-500/50"
                    />
                </div>
            )}
        </section>
    );
}
