import React from "react";
import Link from "next/link";
import Image from "next/image";
import { UnifiedMedia } from "@/services/media.service";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DragScroll } from "@/components/drag-scroll";
import { HomeRowLabel } from "@/components/home-section-header";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { Bookmark, ChevronRight, ImageOff, Star } from "lucide-react";
import { formatAirDayRelative } from "@/lib/air-moment";
import { getRowExtras } from "@/lib/row-extras";
import { SpotlightRow, type SpotlightItem } from "@/components/spotlight-row";

// Build the slug from the MDL url field (e.g. "/754361-title" → "754361-title")
export function mdlSlugFromUrl(url: string) {
    return url.replace(/^\//, "");
}

type LinkedMap = Map<string, { tmdbExternalId: string; season?: number }>;

// Next-episode info keyed by CachedEpisode.mediaId: the TMDB external id for
// linked shows, `mdl-<slug>` for unlinked ones.
export type NextEpisodeMap = Map<string, { airDate: string; airDateTime?: string | null; episodeNumber: number }>;

// Cache key under which a show's next episode is stored (see NextEpisodeMap)
export function nextEpisodeCacheKey(media: UnifiedMedia, linkedBySlug: LinkedMap): string {
    const slug = mdlSlugFromUrl(media.id.replace(/^mdl-/, ""));
    return linkedBySlug.get(slug)?.tmdbExternalId ?? `mdl-${slug}`;
}

// Resolve where a card links to and what state it carries. `bookmarked` and
// `unlinkedSlug` are mutually exclusive: bookmarking requires a TMDB link.
function resolveCard(
    media: UnifiedMedia,
    linkedBySlug: LinkedMap,
    watchlistIds: Set<string>,
): { href: string; bookmarked: boolean; unlinkedSlug?: string; cacheKey: string } {
    const slug = mdlSlugFromUrl(media.id.replace(/^mdl-/, ""));
    const entry = linkedBySlug.get(slug);
    const tmdbExternalId = entry?.tmdbExternalId;

    if (tmdbExternalId) {
        return {
            href: `/media/tmdb-${tmdbExternalId}${entry?.season ? `?season=${entry.season}` : ""}`,
            bookmarked: watchlistIds.has(tmdbExternalId),
            cacheKey: tmdbExternalId,
        };
    }

    return { href: `/media/mdl-${slug}`, bookmarked: false, unlinkedSlug: slug, cacheKey: `mdl-${slug}` };
}

// A premiere is months out, not days, so the relative wording used for the next
// episode doesn't apply. The year is always kept: this replaces the year in the
// caption, so dropping it would take information away rather than add it.
function formatPremiere(airDate: string): string {
    const date = new Date(`${airDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function BookmarkBadge({ className }: { className: string }) {
    return (
        <div className={className}>
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
            </span>
        </div>
    );
}

// MDL ratings are always sky blue (TMDB ratings are the yellow ones)
function MdlRating({ rating, className = "" }: { rating: number; className?: string }) {
    if (rating <= 0) return null;
    return (
        <span className={`flex items-center gap-0.5 text-sky-400 font-semibold ${className}`}>
            <Star className="h-3 w-3 fill-current" />
            {rating.toFixed(1)}
        </span>
    );
}

// Variant B "backdrop": poster with its text underneath, and no card around it.
//
// It used to be a filled, bordered rectangle holding a poster side by side with
// its text. Removing the frame alone did not work: a tall poster next to two
// short lines always leaves an L-shaped void, and the frame was the only thing
// giving that pair a silhouette. No amount of spacing fixes it — the
// composition has to change. Stacked, the poster's own width measures the text
// and the two share both vertical edges, so the grouping needs nothing drawn
// around it. The posters stay smaller than the Top Rated row's, which keeps the
// two apart without a second visual language.
function BackdropCard({
    media,
    href,
    bookmarked,
    unlinkedSlug,
    nextEpisode,
}: {
    media: UnifiedMedia;
    href: string;
    bookmarked: boolean;
    unlinkedSlug?: string;
    nextEpisode?: { airDate: string; airDateTime?: string | null; episodeNumber: number };
}) {
    return (
        <Link href={href} className="group shrink-0 w-32 sm:w-36 md:w-40 whitespace-normal">
            <div className="relative aspect-2/3 w-full rounded-lg overflow-hidden bg-white/5">
                {media.poster ? (
                    <Image
                        unoptimized
                        src={media.poster}
                        alt={media.title}
                        fill
                        sizes="160px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                        <ImageOff className="h-4 w-4" />
                    </div>
                )}

                {bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                {unlinkedSlug && (
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <LinkToTmdbButton mdlSlug={unlinkedSlug} defaultQuery={media.title} compact />
                    </div>
                )}
            </div>

            <div className="pt-2 space-y-0.5">
                <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-sky-200 transition-colors">
                    {media.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-white/60">
                    {nextEpisode ? (
                        // No separator inside this one: unlike a weekday, "in 3d"
                        // completes the phrase rather than standing as a second
                        // field, and a bullet mid-sentence broke it in two.
                        <span className="text-emerald-400 font-semibold">
                            Ep {nextEpisode.episodeNumber}{" "}
                            {formatAirDayRelative(nextEpisode.airDate, nextEpisode.airDateTime)}
                        </span>
                    ) : media.year ? (
                        <span>{media.year}</span>
                    ) : null}
                    {/* Only when there is something on both sides: the schedule
                        is missing on some cards, and the rating hides itself at 0 */}
                    {(nextEpisode || media.year) && media.rating > 0 && (
                        <span className="text-white/30">·</span>
                    )}
                    <MdlRating rating={media.rating} />
                </div>
            </div>
        </Link>
    );
}

export async function DramaRow({
    items,
    linkedBySlug,
    watchlistIds,
    accentClass,
    accentText = "text-sky-400",
    label,
    seeMoreHref,
    variant,
    leadKicker,
    nextEpisodes,
    datesArePremieres = false,
}: {
    items: UnifiedMedia[];
    linkedBySlug: LinkedMap;
    watchlistIds: Set<string>;
    accentClass: string;
    accentText?: string;
    label: string;
    seeMoreHref: string;
    variant: "spotlight" | "backdrop";
    leadKicker?: string;
    nextEpisodes?: NextEpisodeMap;
    // Coming Soon: the cached date is a premiere, not the next episode of a
    // show already running, so it is worded and placed differently
    datesArePremieres?: boolean;
}) {
    if (items.length === 0) return null;

    const isSpotlight = variant === "spotlight";

    // Any card in a spotlight row can be promoted to the lead, so the MDL
    // enrichment is fetched for the whole row rather than for the first item.
    // Three set-based queries — see getRowExtras for why that stays cheap.
    const extrasBySlug = isSpotlight
        ? await getRowExtras(items.map((m) => mdlSlugFromUrl(m.id.replace(/^mdl-/, ""))))
        : null;

    const premiereFor = (media: UnifiedMedia, cacheKey: string) => {
        if (!datesArePremieres) return undefined;
        const d = nextEpisodes?.get(cacheKey)?.airDate;
        return d ? formatPremiere(d) : undefined;
    };

    const spotlightItems: SpotlightItem[] = isSpotlight
        ? items.map((media) => {
              const resolved = resolveCard(media, linkedBySlug, watchlistIds);
              return {
                  id: media.id,
                  title: media.title,
                  poster: media.poster,
                  year: media.year,
                  rating: media.rating,
                  // Clamped to four lines on screen; the rest would be payload
                  // shipped to the browser for nothing.
                  synopsis: media.synopsis ? media.synopsis.slice(0, 320) : undefined,
                  href: resolved.href,
                  bookmarked: resolved.bookmarked,
                  unlinkedSlug: resolved.unlinkedSlug,
                  premiere: premiereFor(media, resolved.cacheKey),
                  extras: extrasBySlug?.get(mdlSlugFromUrl(media.id.replace(/^mdl-/, ""))) ?? null,
              };
          })
        : [];

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
            <DragScroll>
            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4" viewportStyle={{ overflowY: "hidden" }}>
                {isSpotlight ? (
                    <SpotlightRow
                        items={spotlightItems}
                        kicker={leadKicker ?? `#1 ${label}`}
                        kickerClass={accentText}
                    />
                ) : (
                    /* No horizontal padding here: the ScrollArea's -mx/px pair above
                       already provides the room a hover-scaled card needs to grow
                       into, and adding padding on top of it pushed the first card
                       out of line with the section title. Vertical padding stays —
                       it costs no alignment. */
                    <div className="flex gap-4 md:gap-6 py-3 md:py-4">
                        {items.map((media) => {
                            const resolved = resolveCard(media, linkedBySlug, watchlistIds);
                            return (
                                <BackdropCard
                                    key={media.id}
                                    media={media}
                                    {...resolved}
                                    nextEpisode={nextEpisodes?.get(resolved.cacheKey)}
                                />
                            );
                        })}
                    </div>
                )}
                <ScrollBar orientation="horizontal" className="opacity-50" />
            </ScrollArea>
            </DragScroll>
        </div>
    );
}
