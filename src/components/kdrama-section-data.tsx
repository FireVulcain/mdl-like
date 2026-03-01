import React from "react";
import { mediaService, UnifiedMedia } from "@/services/media.service";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { MediaCard } from "@/components/media-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Bookmark, ChevronRight } from "lucide-react";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

// Build the slug from the MDL url field (e.g. "/754361-title" → "754361-title")
function mdlSlugFromUrl(url: string) {
    return url.replace(/^\//, "");
}

// Resolve the href and overlay for a KDrama card
function resolveCard(
    media: UnifiedMedia,
    linkedBySlug: Map<string, { tmdbExternalId: string; season?: number }>,
    watchlistIds: Set<string>,
): { href: string; overlay: React.ReactNode } {
    const slug = mdlSlugFromUrl(media.id.replace(/^mdl-/, ""));
    const entry = linkedBySlug.get(slug);
    const tmdbExternalId = entry?.tmdbExternalId;

    const bookmarkOverlay = tmdbExternalId && watchlistIds.has(tmdbExternalId) ? (
        <div className="absolute bottom-2 left-2">
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
            </span>
        </div>
    ) : null;

    if (tmdbExternalId) {
        return {
            href: `/media/tmdb-${tmdbExternalId}${entry?.season ? `?season=${entry.season}` : ""}`,
            overlay: bookmarkOverlay,
        };
    }

    // Not linked yet — open MDL externally and show the link button
    const mdlUrl = `https://mydramalist.com/${slug}`;
    return {
        href: mdlUrl,
        overlay: (
            <>
                {bookmarkOverlay}
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <LinkToTmdbButton mdlSlug={slug} defaultQuery={media.title} compact />
                </div>
            </>
        ),
    };
}

function KDramaRow({
    items,
    linkedBySlug,
    watchlistIds,
    accentClass,
    label,
    seeMoreHref,
}: {
    items: UnifiedMedia[];
    linkedBySlug: Map<string, string>;
    watchlistIds: Set<string>;
    accentClass: string;
    label: string;
    seeMoreHref: string;
}) {
    return (
        <div className="space-y-3 md:space-y-4">
            <div className="flex items-center gap-2 md:gap-3">
                <div className={`w-1 h-5 md:h-6 rounded-full ${accentClass}`} />
                <h3 className="text-base md:text-lg font-semibold text-white">{label}</h3>
                <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                <Link
                    href={seeMoreHref}
                    className="flex items-center gap-0.5 text-xs text-gray-400 hover:text-white transition-colors shrink-0"
                >
                    See more <ChevronRight className="h-3.5 w-3.5" />
                </Link>
            </div>
            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                    {items.map((media) => {
                        const { href, overlay } = resolveCard(media, linkedBySlug, watchlistIds);
                        return (
                            <div key={media.id} className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300">
                                <MediaCard
                                    media={media}
                                    mdlRating={media.rating || undefined}
                                    href={href}
                                    overlay={overlay}
                                />
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="opacity-50" />
            </ScrollArea>
        </div>
    );
}

export async function KDramaSectionData() {
    const [kdramas, watchlistExternalIds] = await Promise.all([mediaService.getKDramas(), getWatchlistExternalIds()]);
    const watchlistIds = new Set(watchlistExternalIds);

    // Batch-look up which MDL slugs are already linked to a TMDB entry in the cache
    const allShows = [...kdramas.trending, ...kdramas.airing, ...kdramas.upcoming];
    const slugs = allShows.map((m) => mdlSlugFromUrl(m.id.replace(/^mdl-/, "")));

    const [linkedRows, seasonRows] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true, season: true },
        }),
    ]);
    const linkedBySlug = new Map([
        ...linkedRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
        ...seasonRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season }] as const),
    ]);

    return (
        <section className="relative space-y-6 md:space-y-8 bg-white/2 backdrop-blur-sm p-4 md:p-8 rounded-xl border border-white/5 shadow-lg overflow-hidden">
            {/* Atmospheric Background Effects */}
            <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-blue-500/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-48 md:w-96 h-48 md:h-96 bg-blue-600/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1 md:space-y-2">
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                        <h2 className="text-xl md:text-3xl font-bold text-white">K-Drama Universe</h2>
                        <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                            <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] md:text-xs font-medium text-blue-300">LIVE</span>
                        </div>
                    </div>
                    <p className="text-xs md:text-sm text-gray-400">Fresh from Seoul · Trending, airing, and upcoming series</p>
                </div>
            </div>

            <div className="space-y-6 md:space-y-10">
                <KDramaRow
                    items={kdramas.trending}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-linear-to-b from-blue-500 to-blue-400"
                    label="Popular Right Now"
                    seeMoreHref="/dramas?category=popular&country=KR"
                />
                <KDramaRow
                    items={kdramas.airing}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-linear-to-b from-emerald-500 to-emerald-400"
                    label="Airing Now"
                    seeMoreHref="/dramas?category=airing&country=KR"
                />
                {kdramas.upcoming.length > 0 && (
                    <KDramaRow
                        items={kdramas.upcoming}
                        linkedBySlug={linkedBySlug}
                        watchlistIds={watchlistIds}
                        accentClass="bg-linear-to-b from-amber-500 to-amber-400"
                        label="Coming Soon"
                        seeMoreHref="/dramas?category=upcoming&country=KR"
                    />
                )}
            </div>
        </section>
    );
}
