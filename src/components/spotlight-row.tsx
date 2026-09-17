"use client";

import Link from "next/link";
import Image from "next/image";
import { Bookmark, ImageOff, Star, UserRound } from "lucide-react";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { SpotlightInfoButton } from "@/components/spotlight-info-button";
import type { RowExtras } from "@/lib/row-extras";

export type SpotlightItem = {
    id: string;
    title: string;
    poster: string | null;
    year?: string;
    rating: number;
    synopsis?: string;
    href: string;
    bookmarked: boolean;
    unlinkedSlug?: string;
    // Replaces the year when a premiere date is known (Coming Soon)
    premiere?: string;
    extras?: RowExtras | null;
    // MDL slug, for the info popover to fetch the rest by
    slug: string;
};

function BookmarkBadge({ className }: { className: string }) {
    return (
        <div className={className}>
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                <Bookmark className="h-3.5 w-3.5 text-fg fill-current" />
            </span>
        </div>
    );
}

function MdlRating({ rating, className = "" }: { rating: number; className?: string }) {
    if (rating <= 0) return null;
    return (
        <span className={`flex items-center gap-0.5 text-sky-400 font-semibold ${className}`}>
            <Star className="h-3 w-3 fill-current" />
            {rating.toFixed(1)}
        </span>
    );
}

/** The #1 card: poster beside the title, synopsis, genres and cast. */
function SpotlightLead({
    item,
    kicker,
    kickerClass,
}: {
    item: SpotlightItem;
    kicker: string;
    kickerClass: string;
}) {
    const extras = item.extras;
    return (
        // The card is not a link — a link laid underneath it is. An <a> inside an
        // <a> is invalid and the browser silently unnests it, so the cast faces
        // could never be links of their own that way. Inverted, the card's link is
        // a sibling covering the whole box, the content sits above it but lets
        // clicks fall through, and anything that needs its own destination takes
        // its events back. No z-index involved: paint order already does it.
        <div className="group relative shrink-0 w-85 sm:w-100 md:w-140 lg:w-160 mr-2 md:mr-4 whitespace-normal">
            <Link href={item.href} aria-label={item.title} className="absolute inset-0" />
            <div className="relative flex items-center gap-4 md:gap-5 pointer-events-none">
                <div className="relative h-64 sm:h-72 md:h-80 aspect-2/3 rounded-lg overflow-hidden shrink-0 bg-surface-2">
                    {item.poster ? (
                        <Image
                            unoptimized
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                            <ImageOff className="h-5 w-5" />
                        </div>
                    )}

                    {item.bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                    {item.unlinkedSlug && (
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                            <LinkToTmdbButton mdlSlug={item.unlinkedSlug} defaultQuery={item.title} compact />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5 md:space-y-2">
                        <p className={`text-[11px] font-bold tracking-wide ${kickerClass}`}>{kicker}</p>
                        <h4 className="text-lg md:text-xl font-extrabold text-fg leading-tight line-clamp-3 group-hover:text-sky-200 transition-colors">
                            {item.title}
                        </h4>
                        <div className="flex items-center gap-2.5 text-xs text-fg-muted">
                            {item.premiere ? <span>{item.premiere}</span> : item.year ? <span>{item.year}</span> : null}
                            <MdlRating rating={item.rating} />
                            {extras?.mdlRanking ? (
                                <span className="text-sky-300/60 font-medium">MDL #{extras.mdlRanking}</span>
                            ) : null}
                        </div>
                        {extras && extras.genres.length > 0 && (
                            <p className="text-[11px] text-fg-dim">{extras.genres.join(" · ")}</p>
                        )}
                        {item.synopsis && (
                            <p className="hidden md:line-clamp-4 text-xs text-fg-dim leading-relaxed">{item.synopsis}</p>
                        )}
                        {extras && extras.cast.length > 0 && (
                            <div className="hidden md:flex items-center gap-2.5 pt-1">
                                {/* Faces take their events back from the card so each
                                    one can lead to its own actor. The overlap means a
                                    later avatar covers the previous one's right edge,
                                    so each is raised over the one before it — the
                                    visible part of a face is the part you can click. */}
                                <div className="flex -space-x-2 pointer-events-auto">
                                    {extras.cast.map((c, i) => {
                                        const face = c.profileImage ? (
                                            <Image
                                                unoptimized
                                                src={c.profileImage}
                                                alt={c.name}
                                                width={28}
                                                height={28}
                                                className="h-7 w-7 rounded-full object-cover ring-2 ring-page transition-transform group-hover/face:scale-110"
                                            />
                                        ) : (
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-4 ring-2 ring-page transition-transform group-hover/face:scale-110">
                                                <UserRound className="h-3.5 w-3.5 text-fg-muted" />
                                            </span>
                                        );
                                        const style = { zIndex: i };
                                        return c.href ? (
                                            <Link
                                                key={c.name}
                                                href={c.href}
                                                title={c.name}
                                                style={style}
                                                className="group/face relative rounded-full"
                                            >
                                                {face}
                                            </Link>
                                        ) : (
                                            <span key={c.name} title={c.name} style={style} className="relative">
                                                {face}
                                            </span>
                                        );
                                    })}
                                </div>
                                <span className="text-xs text-fg-dim truncate">
                                    {extras.cast.map((c) => c.name).join(" · ")}
                                </span>
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

/** A show waiting its turn. Same stacked composition as the airing row. */
function SpotlightCell({ item }: { item: SpotlightItem }) {
    return (
        <Link href={item.href} className="group shrink-0 w-32 sm:w-40 md:w-44 whitespace-normal">
            <div className="relative aspect-2/3 w-32 sm:w-40 md:w-44 rounded-lg overflow-hidden bg-surface-2">
                {item.poster ? (
                    <Image
                        unoptimized
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="176px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                        <ImageOff className="h-4 w-4" />
                    </div>
                )}

                {item.bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                {item.unlinkedSlug && (
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <LinkToTmdbButton mdlSlug={item.unlinkedSlug} defaultQuery={item.title} compact />
                    </div>
                )}
                {/* Top corner: the bottom ones belong to the bookmark and the
                    link button, and this one should read as "about", not "act". */}
                <div className="absolute top-2 right-2">
                    <SpotlightInfoButton
                        slug={item.slug}
                        title={item.title}
                        year={item.year}
                        premiere={item.premiere}
                        rating={item.rating}
                        synopsis={item.synopsis}
                    />
                </div>
            </div>

            <div className="pt-2 space-y-0.5">
                <h4 className="text-sm font-semibold text-fg leading-snug line-clamp-2 group-hover:text-sky-200 transition-colors">
                    {item.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-fg-muted">
                    {item.premiere ? <span>{item.premiere}</span> : item.year ? <span>{item.year}</span> : null}
                    {(item.premiere || item.year) && item.rating > 0 && <span className="text-fg-faint">·</span>}
                    <MdlRating rating={item.rating} />
                </div>
            </div>
        </Link>
    );
}

/**
 * The #1 card gets the big slot with its synopsis and cast; the rest of the row
 * are plain poster cards. The lead used to change on a long hover, which
 * surprised more often than it helped, so the slot is fixed now.
 */
export function SpotlightRow({
    items,
    kicker,
    kickerClass,
}: {
    items: SpotlightItem[];
    kicker: string;
    kickerClass: string;
}) {
    if (items.length === 0) return null;

    return (
        <div className="flex gap-4 md:gap-6 py-3 md:py-4">
            <SpotlightLead item={items[0]} kicker={kicker} kickerClass={kickerClass} />
            {items.slice(1).map((item) => (
                <SpotlightCell key={item.id} item={item} />
            ))}
        </div>
    );
}
