"use client";

import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
    if (items.length === 0) return null;

    return (
        <section className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 md:gap-3">
                <Play className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
                <h2 className="text-lg md:text-2xl font-bold text-white">Continue Watching</h2>
                <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent"></div>
                <Link href="/watchlist" className="ml-auto flex items-center gap-1 text-xs md:text-sm text-gray-400 hover:text-white transition-colors">
                    <span className="hidden sm:inline">View Watchlist</span>
                    <span className="sm:hidden">View</span>
                    <ArrowRight className="h-3 w-3 md:h-4 md:w-4" />
                </Link>
            </div>
            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                    {items.map((show, index) => {
                        const progressPercent = (show.progress / show.totalEp) * 100;
                        return (
                            <motion.div
                                key={show.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="w-64 sm:w-72 md:w-96 shrink-0"
                            >
                                <Link href={`/media/${show.source.toLowerCase()}-${show.externalId}`} className="group block">
                                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20 border border-white/5 hover:border-white/20 transition-all shadow-lg">
                                        {(show.backdrop || show.poster) && (
                                            <Image
                                                src={show.backdrop || show.poster}
                                                alt={show.title ?? ""}
                                                fill
                                                className="object-cover group-hover:scale-105 transition-transform duration-300"
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-linear-to-t from-black via-black/50 to-transparent" />

                                        {/* Play button overlay */}
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                                                <Play className="h-4 w-4 md:h-5 md:w-5 text-white fill-white" />
                                            </div>
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 p-2 md:p-2.5">
                                            <p className="text-white font-medium text-xs md:text-sm mb-1 md:mb-1.5 line-clamp-1 whitespace-normal">{show.title}</p>
                                            <div className="space-y-0.5 md:space-y-1">
                                                <div className="flex justify-between text-[10px] md:text-xs text-gray-300">
                                                    <span>
                                                        Ep {show.progress} / {show.totalEp}
                                                    </span>
                                                    <span>{Math.round(progressPercent)}%</span>
                                                </div>
                                                <div className="relative h-0.5 md:h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="absolute inset-y-0 left-0 bg-linear-to-r from-blue-500 to-cyan-500 rounded-full"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </motion.div>
                        );
                    })}
                </motion.div>
                <ScrollBar orientation="horizontal" className="opacity-50" />
            </ScrollArea>
        </section>
    );
}
