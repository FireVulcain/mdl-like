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

    // Clamped: totalEp falls back to 1 when a show's length is unknown, which
    // would otherwise draw a bar several times its own width.
    const progressPercent = Math.min(100, (selectedShow.progress / selectedShow.totalEp) * 100);
    const remaining = selectedShow.totalEp - selectedShow.progress;

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
                        <Image unoptimized={true}
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
            <div className="absolute inset-0 bg-linear-to-r from-page via-page/80 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-t from-page via-transparent to-page/30" />
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-page" />

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
                            // The title was wrapping at 576px with 1300px free to
                            // its right, because this cap was sized for the meta
                            // line rather than for the heading. Widened past the
                            // large breakpoint only — below it the carousel on the
                            // right is close enough to collide. Nothing else here
                            // stretches: the progress bar has a fixed width and the
                            // rest is content-sized.
                            className="max-w-xl lg:max-w-4xl space-y-4 md:space-y-6"
                        >
                            {/* No label above the title: a poster, an episode count
                                and a Continue button already say what this is. */}

                            {/* Title */}
                            {/* 60px, not 72: at 72 the longest titles in the list
                                need 985px and wrap on most screens anyway. Balanced
                                wrapping for the few that still do, so a title never
                                breaks to a single orphan word. */}
                            <h2 className="font-display text-4xl md:text-6xl font-semibold text-white leading-[1.05] tracking-tight text-balance">
                                {selectedShow.title}
                            </h2>

                            {/* Progress, said once. The bar carries the proportion and
                                the line carries the counts; the percentage was a third
                                telling of the same fact. The bar also stands in for the
                                accent rule the section headers draw here — same weight,
                                same place, but it means something. */}
                            <div className="space-y-2.5">
                                <div className="relative h-0.5 w-64 md:w-80 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progressPercent}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="absolute inset-y-0 left-0 bg-sky-400 rounded-full"
                                    />
                                </div>
                                <p className="text-sm text-gray-400">
                                    Episode {selectedShow.progress} of {selectedShow.totalEp}
                                    {remaining > 0 && ` · ${remaining} left`}
                                </p>
                            </div>

                            {/* One action, and a way out. Two filled buttons side by
                                side gave equal weight to "keep watching" and "go
                                somewhere else". */}
                            <div className="flex items-center gap-6 pt-2">
                                <Link
                                    href={`/media/${selectedShow.source.toLowerCase()}-${selectedShow.externalId}`}
                                    className="flex items-center gap-2.5 px-5 py-2.5 bg-white hover:bg-white/90 text-page text-sm font-semibold rounded-lg transition-colors"
                                >
                                    <Play className="h-4 w-4 fill-current" />
                                    <span>Continue</span>
                                </Link>
                                <Link
                                    href="/watchlist"
                                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    <span>Watchlist</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Right side - Horizontal carousel at screen edge */}
                <div className="hidden md:flex absolute right-8 bottom-24 items-center">
                    {/* Navigation arrow - only shown when there are multiple items */}
                    {items.length > 1 && (
                        <button
                            onClick={() => handleSelect((selectedIndex - 1 + items.length) % items.length)}
                            className="cursor-pointer absolute -left-14 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 transition-all"
                        >
                            <ChevronLeft className="h-5 w-5 text-white" />
                        </button>
                    )}

                    {/* Carousel container - shows 2.5 cards with padding for ring (or 1 card when single item) */}
                    <div
                        className="overflow-hidden px-2 py-2"
                        style={{ width: items.length === 1 ? "calc(1 * 200px + 16px)" : "calc(2.5 * 200px + 2 * 16px + 16px)" }}
                    >
                        <motion.div
                            className="flex gap-4 pl-1"
                            animate={{ x: -selectedIndex * (200 + 16) }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        >
                            {/* Render items twice for infinite scroll illusion (only when multiple items) */}
                            {(items.length > 1 ? [...items, ...items] : items).map((show, index) => {
                                const actualIndex = index % items.length;
                                const isSelected = actualIndex === selectedIndex;
                                const showProgress = (show.progress / show.totalEp) * 100;

                                return (
                                    <motion.button
                                        key={`${show.id}-${index}`}
                                        onClick={() => handleSelect(actualIndex)}
                                        whileHover={{ scale: 1.03 }}
                                        className={`relative shrink-0 w-50 h-32.5 rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                                            isSelected ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-page" : "opacity-60 hover:opacity-100"
                                        }`}
                                    >
                                        <Image unoptimized={true} src={show.backdrop || show.poster} alt={show.title ?? ""} fill className="object-cover" />
                                        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                                        {/* Title overlay */}
                                        <div className="absolute bottom-0 left-0 right-0 p-2">
                                            <p className="text-white text-xs font-medium line-clamp-1">{show.title}</p>
                                            {isSelected && (
                                                <div className="mt-1 relative h-0.5 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-sky-400 rounded-full"
                                                        style={{ width: `${showProgress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {/* Selected indicator */}
                                        {isSelected && (
                                            <motion.div
                                                layoutId="selectedIndicator"
                                                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-sky-400"
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
                                index === selectedIndex ? "w-6 h-2 bg-sky-400" : "w-2 h-2 bg-white/30 hover:bg-white/50"
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
                        className="h-full bg-sky-400/40"
                    />
                </div>
            )}
        </section>
    );
}
