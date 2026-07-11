import React from "react";
import { mediaService, UnifiedMedia } from "@/services/media.service";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { MediaCard } from "@/components/media-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Bookmark, ChevronRight } from "lucide-react";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { HomeSectionHeader, HomeRowLabel } from "@/components/home-section-header";
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

    // Not linked yet — navigate to internal MDL page and show the link button
    return {
        href: `/media/mdl-${slug}`,
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
    linkedBySlug: Map<string, { tmdbExternalId: string; season?: number }>;
    watchlistIds: Set<string>;
    accentClass: string;
    label: string;
    seeMoreHref: string;
}) {
    return (
        <div className="space-y-2 md:space-y-3">
            <div className="flex items-center gap-3">
                <HomeRowLabel dotClass={accentClass} label={label} />
                <div className="flex-1 h-px bg-linear-to-r from-white/8 to-transparent" />
                <Link
                    href={seeMoreHref}
                    className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-white transition-colors shrink-0"
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

    const [linkedRows, seasonRows, aliasRows] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true, season: true },
        }),
        prisma.mdlAlias.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
    ]);
    const linkedBySlug = new Map([
        ...linkedRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
        ...seasonRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season }] as const),
        ...aliasRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
    ]);

    return (
        <section className="relative space-y-6 md:space-y-10">
            {/* Ambient glow anchored to the page, not a box */}
            <div className="absolute -top-24 right-0 w-72 md:w-120 h-72 md:h-120 bg-sky-500/6 rounded-full blur-[100px] md:blur-[160px] -z-10 pointer-events-none" />

            <HomeSectionHeader
                index="02"
                eyebrow="South Korea"
                title="K-Drama Universe"
                subtitle="Fresh from Seoul · Trending, airing, and upcoming series"
                accent="sky"
                live
            />

            <div className="space-y-6 md:space-y-10">
                <KDramaRow
                    items={kdramas.trending}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-sky-400"
                    label="Popular Right Now"
                    seeMoreHref="/dramas?category=popular&country=KR"
                />
                <KDramaRow
                    items={kdramas.airing}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-emerald-400"
                    label="Airing Now"
                    seeMoreHref="/dramas?category=airing&country=KR"
                />
                {kdramas.upcoming.length > 0 && (
                    <KDramaRow
                        items={kdramas.upcoming}
                        linkedBySlug={linkedBySlug}
                        watchlistIds={watchlistIds}
                        accentClass="bg-amber-400"
                        label="Coming Soon"
                        seeMoreHref="/dramas?category=upcoming&country=KR"
                    />
                )}
            </div>
        </section>
    );
}
