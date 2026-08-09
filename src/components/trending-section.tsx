"use client";

import { motion } from "framer-motion";
import { UnifiedMedia } from "@/services/media.service";
import { MediaCard } from "@/components/media-card";
import { HomeSectionHeader } from "@/components/home-section-header";
import { Bookmark } from "lucide-react";

/**
 * Trending reads as a chart, because ranking is the whole point of it and no
 * other home section is ranked — that is what sets it apart from the drama
 * universes, which are carousels with no order to speak of.
 *
 * It used to lead with a full-bleed backdrop. Backdrops are landscape stills
 * cropped blind by object-cover, so faces and titles landed off-centre often
 * enough to look broken. Posters are authored to be read whole at this size,
 * so the section is posters throughout and the framing problem disappears.
 */
export function TrendingSection({ items, watchlistIds = [] }: { items: UnifiedMedia[]; watchlistIds?: string[] }) {
    if (!items || items.length === 0) return null;

    const inWatchlist = new Set(watchlistIds);
    // TMDB returns 20 per page, but getTrending drops person entries, so the
    // count can land under 20 without warning — hence no number in the subtitle.
    const ranked = items.slice(0, 20);

    const container = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } },
    };
    const itemAnim = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 },
    };

    return (
        <div className="relative space-y-6 md:space-y-10">
            <HomeSectionHeader title="Trending Worldwide" accent="orange" />

            <motion.div
                variants={container}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6"
            >
                {ranked.map((media, i) => (
                    <motion.div key={media.id} variants={itemAnim}>
                        <MediaCard
                            media={media}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            overlay={
                                <>
                                    {/* The numeral is this section's signature. Outlined rather
                                        than filled so it sits over artwork without hiding it,
                                        and large enough to read as a rank, not a badge. */}
                                    <span
                                        className="pointer-events-none absolute -bottom-1 left-1.5 text-5xl md:text-6xl font-black leading-none tabular-nums text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
                                        style={{ WebkitTextStroke: "1.5px rgba(0,0,0,0.5)" }}
                                    >
                                        {i + 1}
                                    </span>
                                    {inWatchlist.has(media.externalId) && (
                                        <div className="absolute bottom-2 right-2">
                                            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                            </span>
                                        </div>
                                    )}
                                </>
                            }
                        />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
