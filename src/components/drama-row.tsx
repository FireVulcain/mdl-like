import React from "react";
import Link from "next/link";
import Image from "next/image";
import { UnifiedMedia } from "@/services/media.service";
import { MediaCard } from "@/components/media-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DragScroll } from "@/components/drag-scroll";
import { HomeRowLabel } from "@/components/home-section-header";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { Bookmark, ChevronRight, ImageOff, Star, UserRound } from "lucide-react";
import { formatAirDayRelative } from "@/lib/air-moment";
import { prisma } from "@/lib/prisma";

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

// Cached MDL enrichment for the spotlight lead (genres, cast faces, global rank)
type LeadExtras = {
    genres: string[];
    cast: { name: string; profileImage: string | null }[];
    mdlRanking: number | null;
};

async function getLeadExtras(media: UnifiedMedia): Promise<LeadExtras | null> {
    const slug = mdlSlugFromUrl(media.id.replace(/^mdl-/, ""));
    let row = await prisma.cachedMdlData.findFirst({
        where: { mdlSlug: slug },
        select: { genres: true, castJson: true, mdlRanking: true },
    });
    if (!row) {
        // The slug might be an alias of the canonical entry
        const alias = await prisma.mdlAlias.findUnique({ where: { mdlSlug: slug }, select: { tmdbExternalId: true } });
        if (alias) {
            row = await prisma.cachedMdlData.findUnique({
                where: { tmdbExternalId: alias.tmdbExternalId },
                select: { genres: true, castJson: true, mdlRanking: true },
            });
        }
    }
    if (!row) {
        // Same MDL id, different slug text (MDL slugs drift with title changes)
        const numericId = slug.match(/^(\d+)-/)?.[1];
        if (numericId) {
            row = await prisma.cachedMdlData.findFirst({
                where: { mdlSlug: { startsWith: `${numericId}-` } },
                select: { genres: true, castJson: true, mdlRanking: true },
            });
        }
    }
    if (!row) return null;

    const genres = Array.isArray(row.genres) ? (row.genres as string[]).filter((g) => typeof g === "string").slice(0, 3) : [];
    const castJson = row.castJson;
    const main =
        castJson && typeof castJson === "object" && !Array.isArray(castJson)
            ? ((castJson as { main?: { name?: string; profileImage?: string }[] }).main ?? [])
            : [];
    const cast = main
        .filter((m) => m.name)
        .slice(0, 3)
        .map((m) => ({ name: m.name!, profileImage: m.profileImage || null }));

    if (genres.length === 0 && cast.length === 0 && !row.mdlRanking) return null;
    return { genres, cast, mdlRanking: row.mdlRanking };
}

// Variant A "spotlight" lead: big poster with the title, meta, synopsis and cast
// beside it (MDL rows have no landscape backdrops to bleed). No frame around the
// pair.
//
// Unlike the airing card, this composition survives losing its box: the text
// column runs kicker → title → meta → genres → four lines of synopsis → cast, so
// it stands nearly as tall as the poster and the two already form a rectangle.
// There was no void for the frame to hide — only a 640px outline in a fill too
// faint to see, and a drop shadow whose sole job was to lift the poster back off
// that fill.
//
// No fixed height: it stretches to match the poster columns (image + caption) so
// the row bottom stays aligned.
function LeadCard({
    media,
    href,
    bookmarked,
    unlinkedSlug,
    kicker,
    kickerClass,
    extras,
    premiere,
}: {
    media: UnifiedMedia;
    href: string;
    bookmarked: boolean;
    unlinkedSlug?: string;
    kicker: string;
    kickerClass: string;
    extras?: LeadExtras | null;
    premiere?: string;
}) {
    return (
        <Link
            href={href}
            // Extra right margin, not an outline, to mark where the lead ends in a
            // row that then runs on into small poster cards.
            className="group shrink-0 w-85 sm:w-100 md:w-140 lg:w-160 mr-2 md:mr-4 whitespace-normal"
        >
            <div className="h-full flex items-center gap-4 md:gap-5">
                <div className="relative h-full aspect-2/3 rounded-lg overflow-hidden shrink-0 bg-white/5">
                    {media.poster ? (
                        <Image
                            unoptimized
                            src={media.poster}
                            alt={media.title}
                            fill
                            sizes="200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                            <ImageOff className="h-5 w-5" />
                        </div>
                    )}

                    {bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                    {unlinkedSlug && (
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <LinkToTmdbButton mdlSlug={unlinkedSlug} defaultQuery={media.title} compact />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
                    <p className={`text-[11px] font-bold tracking-wide ${kickerClass}`}>{kicker}</p>
                    <h4 className="text-lg md:text-xl font-extrabold text-white leading-tight line-clamp-3 group-hover:text-sky-200 transition-colors">
                        {media.title}
                    </h4>
                    <div className="flex items-center gap-2.5 text-xs text-white/60">
                        {premiere ? <span>{premiere}</span> : media.year ? <span>{media.year}</span> : null}
                        <MdlRating rating={media.rating} />
                        {extras?.mdlRanking ? <span className="text-sky-300/60 font-medium">MDL #{extras.mdlRanking}</span> : null}
                    </div>
                    {/* A word doesn't need a container. These were fill + border +
                        full radius around one word, five times over — the same
                        object that was removed from the year on the radar card. */}
                    {extras && extras.genres.length > 0 && (
                        <p className="text-[11px] text-white/50">{extras.genres.join(" · ")}</p>
                    )}
                    {media.synopsis && (
                        <p className="hidden md:line-clamp-4 text-xs text-white/50 leading-relaxed">{media.synopsis}</p>
                    )}
                    {extras && extras.cast.length > 0 && (
                        <div className="hidden md:flex items-center gap-2.5 pt-1">
                            <div className="flex -space-x-2">
                                {extras.cast.map((c) =>
                                    c.profileImage ? (
                                        <Image
                                            unoptimized
                                            key={c.name}
                                            src={c.profileImage}
                                            alt={c.name}
                                            title={c.name}
                                            width={28}
                                            height={28}
                                            className="h-7 w-7 rounded-full object-cover ring-2 ring-page"
                                        />
                                    ) : (
                                        <span
                                            key={c.name}
                                            title={c.name}
                                            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-2 ring-page"
                                        >
                                            <UserRound className="h-3.5 w-3.5 text-gray-400" />
                                        </span>
                                    ),
                                )}
                            </div>
                            <span className="text-xs text-white/50 truncate">
                                {extras.cast.map((c) => c.name).join(" · ")}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
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
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-white/60">
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

function PosterCell({
    media,
    href,
    bookmarked,
    unlinkedSlug,
    premiere,
}: {
    media: UnifiedMedia;
    href: string;
    bookmarked: boolean;
    unlinkedSlug?: string;
    premiere?: string;
}) {
    const overlay = (
        <>
            {bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
            {unlinkedSlug && (
                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <LinkToTmdbButton mdlSlug={unlinkedSlug} defaultQuery={media.title} compact />
                </div>
            )}
        </>
    );
    return (
        <div className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300">
            <MediaCard
                media={media}
                mdlRating={media.rating || undefined}
                href={href}
                overlay={overlay}
                captionLead={premiere}
            />
        </div>
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
    variant = "posters",
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
    variant?: "posters" | "spotlight" | "backdrop";
    leadKicker?: string;
    nextEpisodes?: NextEpisodeMap;
    // Coming Soon: the cached date is a premiere, not the next episode of a
    // show already running, so it is worded and placed differently
    datesArePremieres?: boolean;
}) {
    if (items.length === 0) return null;

    const [lead, ...rest] = items;
    const showLead = variant === "spotlight" && !!lead;
    const leadExtras = showLead ? await getLeadExtras(lead) : null;

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
                {/* No horizontal padding here: the ScrollArea's -mx/px pair above
                    already provides the room a hover-scaled card needs to grow
                    into, and adding padding on top of it pushed the first card
                    out of line with the section title. Vertical padding stays —
                    it costs no alignment. */}
                <div className="flex gap-4 md:gap-6 py-3 md:py-4">
                    {showLead && (
                        <LeadCard
                            media={lead}
                            {...resolveCard(lead, linkedBySlug, watchlistIds)}
                            kicker={leadKicker ?? `#1 ${label}`}
                            kickerClass={accentText}
                            extras={leadExtras}
                            premiere={
                                datesArePremieres
                                    ? (() => {
                                          const d = nextEpisodes?.get(nextEpisodeCacheKey(lead, linkedBySlug))?.airDate;
                                          return d ? formatPremiere(d) : undefined;
                                      })()
                                    : undefined
                            }
                        />
                    )}
                    {(showLead ? rest : items).map((media) => {
                        const resolved = resolveCard(media, linkedBySlug, watchlistIds);
                        return variant === "backdrop" ? (
                            <BackdropCard
                                key={media.id}
                                media={media}
                                {...resolved}
                                nextEpisode={nextEpisodes?.get(resolved.cacheKey)}
                            />
                        ) : (
                            <PosterCell
                                key={media.id}
                                media={media}
                                {...resolved}
                                premiere={
                                    datesArePremieres
                                        ? (() => {
                                              const d = nextEpisodes?.get(resolved.cacheKey)?.airDate;
                                              return d ? formatPremiere(d) : undefined;
                                          })()
                                        : undefined
                                }
                            />
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="opacity-50" />
            </ScrollArea>
            </DragScroll>
        </div>
    );
}
