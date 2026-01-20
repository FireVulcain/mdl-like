"use client";

import { motion } from "framer-motion";
import { UnifiedMedia } from "@/services/media.service";
import { MediaCard } from "@/components/media-card";
import { Badge } from "@/components/ui/badge";
import { Play, Star, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function TrendingSection({ items }: { items: UnifiedMedia[] }) {
    if (!items || items.length === 0) return null;

    const spotlight = items[0];
    const rest = items.slice(1, 13); // Show top 12 more

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemAnim = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 },
    };

    return (
        <div className="space-y-6 md:space-y-12">
            {/* Section Header */}
            <div className="flex items-center gap-3 md:gap-4">
                <div className="p-1.5 md:p-2 rounded-lg md:rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-2xl font-bold tracking-tight">Trending Worldwide</h2>
                    <p className="text-xs md:text-sm text-muted-foreground truncate md:whitespace-normal">Most popular movies and shows this week across all platforms.</p>
                </div>
                <div className="hidden md:block h-px flex-1 bg-linear-to-r from-border to-transparent ml-4" />
            </div>

            {/* Spotlight Hero */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative h-64 sm:h-80 md:h-100 rounded-2xl md:rounded-3xl overflow-hidden group border border-white/10 shadow-2xl shadow-orange-500/5"
            >
                {/* Background Image / Backdrop */}
                <div className="absolute inset-0">
                    <Image
                        src={spotlight.backdrop || spotlight.poster || ""}
                        alt={spotlight.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 85vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        priority
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent" />
                    <div className="absolute inset-0 bg-linear-to-r from-background via-background/20 to-transparent" />
                </div>

                {/* Content */}
                <div className="absolute inset-0 p-4 sm:p-6 md:p-8 flex flex-col justify-end max-w-2xl space-y-2 md:space-y-4">
                    <div className="flex items-center gap-2 md:gap-3">
                        <Badge className="bg-orange-500 hover:bg-orange-600 border-none px-2 md:px-3 py-0.5 md:py-1 text-xs md:text-sm">#1 Trending</Badge>
                        <div className="flex items-center gap-1 text-yellow-500 text-xs md:text-sm font-bold">
                            <Star className="h-3 w-3 md:h-4 md:w-4 fill-current" />
                            {spotlight.rating.toFixed(1)}
                        </div>
                    </div>

                    <h3 className="text-2xl sm:text-3xl md:text-5xl font-black tracking-tighter text-white drop-shadow-lg leading-tight uppercase">
                        {spotlight.title}
                    </h3>

                    <p className="text-muted-foreground line-clamp-2 text-sm md:text-lg drop-shadow hidden sm:block">{spotlight.synopsis}</p>

                    <div className="flex items-center gap-4 pt-2 md:pt-4">
                        <Link
                            href={`/media/${spotlight.id}`}
                            className="bg-white text-black px-4 md:px-8 py-2 md:py-3 rounded-full font-bold flex items-center gap-2 hover:bg-orange-500 hover:text-white transition-colors text-sm md:text-base"
                        >
                            <Play className="h-4 w-4 md:h-5 md:w-5 fill-current" />
                            View Details
                        </Link>
                    </div>
                </div>
            </motion.div>

            {/* Secondary Grid */}
            <motion.div
                variants={container}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-6"
            >
                {rest.map((media) => (
                    <motion.div key={media.id} variants={itemAnim}>
                        <MediaCard media={media} />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
