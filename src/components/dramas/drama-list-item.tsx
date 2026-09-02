import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, ImageOff, Bookmark } from "lucide-react";
import { UnifiedMedia } from "@/services/media.service";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";

// MDL scores out of 10 but draws five stars, so the bar is the score halved.
// Two copies of the same row stacked, the filled one clipped to the fraction —
// that keeps a 9.3 showing four and a half stars rather than rounding it away.
function StarBar({ rating }: { rating: number }) {
    const filled = Math.max(0, Math.min(5, rating / 2));
    const stars = [0, 1, 2, 3, 4];
    return (
        <span className="relative inline-flex shrink-0" aria-hidden>
            <span className="flex gap-0.5 text-surface-4">
                {stars.map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                ))}
            </span>
            <span
                className="absolute inset-0 flex gap-0.5 overflow-hidden text-amber-400"
                style={{ width: `${(filled / 5) * 100}%` }}
            >
                {stars.map((i) => (
                    <Star key={i} className="h-3.5 w-3.5 shrink-0 fill-current" />
                ))}
            </span>
        </span>
    );
}

// The MDL-style row: poster on the left, everything else read as a paragraph on
// the right, with the rank held out at the far edge. Unlike the grid card, the
// synopsis is part of the row rather than something you hover for.
export function DramaListItem({
    media,
    href,
    rank,
    inWatchlist,
    unlinkedSlug,
}: {
    media: UnifiedMedia;
    href: string;
    rank?: number;
    inWatchlist?: boolean;
    unlinkedSlug?: string;
}) {
    const meta = [media.mdlTypeLabel, media.year].filter(Boolean).join(" - ");
    const episodes = media.totalEp ? `${media.totalEp} episode${media.totalEp > 1 ? "s" : ""}` : null;

    return (
        <div className="group flex gap-3 md:gap-4 rounded-xl border border-line-soft bg-surface-1 p-3 md:p-4 transition-colors hover:bg-surface-2">
            <Link href={href} className="relative w-20 sm:w-24 md:w-28 shrink-0 overflow-hidden rounded-lg bg-surface-2 aspect-2/3">
                {media.poster ? (
                    <Image
                        unoptimized
                        src={media.poster}
                        alt={media.title}
                        fill
                        sizes="112px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                        <ImageOff className="h-4 w-4" />
                    </span>
                )}
                {inWatchlist && (
                    <span className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/90 backdrop-blur-sm">
                        <Bookmark className="h-3.5 w-3.5 fill-current text-white" />
                    </span>
                )}
            </Link>

            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href={href}
                                className="font-display text-base md:text-lg font-semibold text-sky-300 transition-colors hover:text-sky-200"
                            >
                                {media.title}
                            </Link>
                            {unlinkedSlug && (
                                <span className="opacity-0 transition-opacity group-hover:opacity-100">
                                    <LinkToTmdbButton mdlSlug={unlinkedSlug} defaultQuery={media.title} compact />
                                </span>
                            )}
                        </div>
                        <p className="mt-0.5 text-xs md:text-sm text-fg-muted">
                            {meta}
                            {episodes && (meta ? `, ${episodes}` : episodes)}
                        </p>
                        {media.rating > 0 && (
                            <div className="mt-1.5 flex items-center gap-2">
                                <StarBar rating={media.rating} />
                                <span className="text-sm font-semibold text-fg">{media.rating.toFixed(1)}</span>
                            </div>
                        )}
                    </div>
                    {rank ? <span className="shrink-0 text-sm text-fg-dim">#{rank}</span> : null}
                </div>

                {media.synopsis && (
                    <p className="mt-2 text-xs md:text-sm leading-relaxed text-fg-soft line-clamp-3">{media.synopsis}</p>
                )}
            </div>
        </div>
    );
}
