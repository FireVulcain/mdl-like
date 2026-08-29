"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { tmdbPersonHref } from "@/lib/person-links";

interface Actor {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

interface CastScrollProps {
    cast: Actor[];
    mediaId: string;
}

/**
 * How many of the billing order count as leads.
 *
 * TMDB has no main/supporting flag — unlike MDL, which states it. What it does
 * carry is the order the production bills its actors in, which is that same
 * claim made by the people who made the show. Episode counts were the other
 * candidate and are worse: a lead can sit out an episode, and a bit part in a
 * long-running show can outnumber them.
 *
 * A fixed cut rather than a computed one, because the numbers give nothing to
 * compute from: order runs 0…9 and then jumps to 500 on a show whose cast is
 * 348 deep. It orders well and thresholds not at all.
 */
const MAIN_CAST_COUNT = 8;

function ActorCard({ actor }: { actor: Actor }) {
    return (
        <Link href={tmdbPersonHref(actor.id)} className="flex-none w-25 space-y-2 group">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-line-strong hover:ring-line-strong transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer hover:scale-105">
                {actor.profile ? (
                    <Image
                        unoptimized={true}
                        src={actor.profile}
                        alt={actor.name}
                        fill
                        className="object-cover opacity-0 transition-opacity duration-700 ease-out"
                        loading="lazy"
                        onLoad={(e) => {
                            const img = e.currentTarget;
                            const container = img.parentElement;
                            setTimeout(() => {
                                img.classList.replace("opacity-0", "opacity-100");
                                container?.classList.remove(
                                    "animate-shimmer",
                                    "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                    "bg-size-[200%_100%]"
                                );
                            }, 100);
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-fg-muted p-1 text-center bg-linear-to-br from-surface-3 to-surface-2">
                        No Image
                    </div>
                )}
            </div>
            <div>
                <div
                    className="text-sm font-medium truncate text-fg group-hover:text-blue-400 transition-colors"
                    title={actor.name}
                >
                    {actor.name}
                </div>
                <div className="text-xs text-fg-muted truncate" title={actor.character}>
                    {actor.character}
                </div>
            </div>
        </Link>
    );
}

export function CastScroll({ cast, mediaId }: CastScrollProps) {
    const [showSupport, setShowSupport] = useState(false);

    if (!cast || cast.length === 0) {
        return null;
    }

    // The service hands this over sorted by billing order.
    const main = cast.slice(0, MAIN_CAST_COUNT);
    const support = cast.slice(MAIN_CAST_COUNT);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-fg">Cast</h3>
                <Link href={`/media/${mediaId}/cast`} className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium">
                    View all →
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 pb-4">
                    {main.map((actor) => (
                        <ActorCard key={actor.id} actor={actor} />
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {support.length > 0 && (
                <>
                    <button
                        onClick={() => setShowSupport((v) => !v)}
                        className="cursor-pointer flex items-center gap-1.5 text-sm text-fg-dim hover:text-fg-soft transition-colors mt-1 mb-3"
                    >
                        {showSupport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showSupport ? "Hide" : "Show"} supporting cast ({support.length})
                    </button>

                    {showSupport && (
                        // Wraps rather than scrolls: the row above is a shortlist
                        // to skim, this is a cast list to read, and it runs to
                        // hundreds on a long series.
                        <div className="flex flex-wrap gap-4 pb-4">
                            {support.map((actor) => (
                                <ActorCard key={actor.id} actor={actor} />
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
