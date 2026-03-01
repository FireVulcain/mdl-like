"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Star } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { Badge } from "@/components/ui/badge";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import type { UnifiedMedia } from "@/services/media.service";
import type { KuryanaRecommendation } from "@/lib/kuryana";

interface Props {
    tmdbRecs: UnifiedMedia[];
    mdlRecs: KuryanaRecommendation[] | null;
    watchlistIds: string[];
    linkedMap: Record<string, string>; // mdlSlug → tmdbExternalId
    tmdbRatingsMap: Record<string, number>;
    mdlSlugToRatingMap: Record<string, number>;
}

export function RecommendationsWithToggle({ tmdbRecs, mdlRecs, watchlistIds, linkedMap, tmdbRatingsMap, mdlSlugToRatingMap }: Props) {
    const hasMdl = mdlRecs && mdlRecs.length > 0;
    const [source, setSource] = useState<"tmdb" | "mdl">(hasMdl ? "mdl" : "tmdb");
    const [localLinkedMap, setLocalLinkedMap] = useState<Record<string, string>>(linkedMap);
    const watchlistSet = new Set(watchlistIds);

    function handleLinked(mdlSlug: string, tmdbExternalId: string) {
        setLocalLinkedMap((prev) => ({ ...prev, [mdlSlug]: tmdbExternalId }));
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Recommendations</h3>
                    {source === "mdl" && hasMdl ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                            via MDL
                        </span>
                    ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors bg-white/5 text-gray-400 border-white/10">
                            via TMDB
                        </span>
                    )}
                </div>
                {hasMdl && (
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                        <button
                            onClick={() => setSource("mdl")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                source === "mdl" ? "bg-primary/20 text-white border border-primary/30" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            MDL
                        </button>
                        <button
                            onClick={() => setSource("tmdb")}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                                source === "tmdb" ? "bg-primary/20 text-white border border-primary/30" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            TMDB
                        </button>
                    </div>
                )}
            </div>

            {source === "tmdb" || !hasMdl ? (
                tmdbRecs.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-6">
                        {tmdbRecs.map((item) => (
                            <MediaCard
                                key={item.id}
                                media={item}
                                mdlRating={item.id.startsWith("tmdb-") ? tmdbRatingsMap[item.externalId] : undefined}
                                overlay={
                                    watchlistSet.has(item.externalId) ? (
                                        <div className="absolute bottom-2 left-2">
                                            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                            </span>
                                        </div>
                                    ) : null
                                }
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-gray-400">No recommendations available via TMDB.</div>
                )
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 md:gap-6">
                    {mdlRecs.slice(0, 6).map((item) => {
                        const slug = item.url.replace(/^\//, "");
                        const tmdbId = localLinkedMap[slug];

                        if (tmdbId) {
                            return (
                                <Link key={item.url} href={`/media/tmdb-${tmdbId}`} className="group block">
                                    <div className="border-0 bg-transparent shadow-none transition-transform duration-300 group-hover:scale-105">
                                        <div className="relative aspect-2/3 w-full overflow-hidden rounded-md bg-secondary">
                                            {mdlSlugToRatingMap[slug] != null && mdlSlugToRatingMap[slug] > 0 && (
                                                <div className="absolute left-1.5 top-1.5 z-10">
                                                    <Badge className="bg-sky-500/90 text-white text-[10px] px-1.5 shadow-md">
                                                        <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                                        {mdlSlugToRatingMap[slug].toFixed(1)}
                                                    </Badge>
                                                </div>
                                            )}
                                            {watchlistSet.has(tmdbId) && (
                                                <div className="absolute bottom-2 left-2 z-10">
                                                    <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                        <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                                    </span>
                                                </div>
                                            )}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.img}
                                                alt={item.title}
                                                className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-80"
                                                loading="lazy"
                                            />
                                        </div>
                                        <div className="p-2">
                                            <h3 className="line-clamp-1 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                                                {item.title}
                                            </h3>
                                        </div>
                                    </div>
                                </Link>
                            );
                        }

                        // Not linked → external link + Link button overlay
                        return (
                            <div key={item.url} className="group block">
                                <div className="border-0 bg-transparent shadow-none transition-transform duration-300 group-hover:scale-105">
                                    <div className="relative aspect-2/3 w-full overflow-hidden rounded-md bg-secondary">
                                        {mdlSlugToRatingMap[slug] != null && mdlSlugToRatingMap[slug] > 0 && (
                                            <div className="absolute left-1.5 top-1.5 z-10">
                                                <Badge className="bg-sky-500/90 text-white text-[10px] px-1.5 shadow-md pointer-events-none">
                                                    <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                                    {mdlSlugToRatingMap[slug].toFixed(1)}
                                                </Badge>
                                            </div>
                                        )}
                                        <a
                                            href={`https://mydramalist.com${item.url}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute inset-0"
                                        >
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.img.replace("_4t.", "_4f.")}
                                                alt={item.title}
                                                className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-80"
                                                loading="lazy"
                                            />
                                            <div className="absolute inset-0 flex items-end justify-end p-1.5">
                                                <ExternalLink className="h-3.5 w-3.5 text-white/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </a>
                                        <div className="absolute bottom-1.5 left-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <LinkToTmdbButton
                                                mdlSlug={slug}
                                                defaultQuery={item.title}
                                                compact
                                                onLinked={(tmdbExternalId) => handleLinked(slug, tmdbExternalId)}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-2">
                                        <h3 className="line-clamp-1 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                                            {item.title}
                                        </h3>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
