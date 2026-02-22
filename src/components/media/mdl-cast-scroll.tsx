"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MdlCast, MdlCastMember } from "@/actions/mdl";

interface TmdbActor {
    id: number;
    name: string;
}

interface MdlCastScrollProps {
    cast: MdlCast;
    // TMDB cast for cross-referencing names → internal person page links
    tmdbCast: TmdbActor[];
}

function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[\s\-.']/g, "");
}

// "/people/16660-song-zu-er" → "16660-song-zu-er"
function mdlPersonSlug(slug: string): string | null {
    const match = slug.match(/\/people\/(.+)$/);
    return match ? match[1] : null;
}

function ActorCard({ actor, tmdbId }: { actor: MdlCastMember; tmdbId?: number }) {
    // Prefer TMDB person page; fall back to internal MDL person page if slug available
    const href = tmdbId
        ? `/cast/${tmdbId}`
        : actor.slug
          ? `/people/${mdlPersonSlug(actor.slug)}`
          : null;

    const inner = (
        <div className="flex-none w-25 space-y-2 group cursor-pointer">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer hover:scale-105">
                {actor.profileImage ? (
                    <Image
                        src={actor.profileImage}
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
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-1 text-center bg-linear-to-br from-gray-800 to-gray-900">
                        No Image
                    </div>
                )}
            </div>
            <div>
                <div className="text-sm font-medium truncate text-white group-hover:text-blue-400 transition-colors" title={actor.name}>
                    {actor.name}
                </div>
                <div className="text-xs text-gray-400 truncate" title={actor.characterName}>
                    {actor.characterName}
                </div>
            </div>
        </div>
    );

    if (href) {
        return (
            <Link href={href} className="flex-none">
                {inner}
            </Link>
        );
    }

    return <div className="flex-none">{inner}</div>;
}

export function MdlCastScroll({ cast, tmdbCast }: MdlCastScrollProps) {
    const [showSupport, setShowSupport] = useState(false);

    const { main, support, guest } = cast;
    const totalSupport = support.length + guest.length;

    if (main.length === 0 && totalSupport === 0) return null;

    // Build normalized name → TMDB person ID map for cross-referencing
    const tmdbMap = new Map<string, number>();
    for (const actor of tmdbCast) {
        tmdbMap.set(normalizeName(actor.name), actor.id);
    }

    const getTmdbId = (name: string) => tmdbMap.get(normalizeName(name));

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Cast & Credits</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-500/15 text-sky-400 border border-sky-500/20">
                        via MDL
                    </span>
                </div>
            </div>

            {/* Main Cast */}
            {main.length > 0 && (
                <>
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Main Role</p>
                    <ScrollArea className="w-full whitespace-nowrap mb-4" viewportStyle={{ overflowY: "hidden" }}>
                        <div className="flex gap-4 pb-4">
                            {main.map((actor) => (
                                <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </>
            )}

            {/* Support / Guest toggle */}
            {totalSupport > 0 && (
                <>
                    <button
                        onClick={() => setShowSupport((v) => !v)}
                        className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-3"
                    >
                        {showSupport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showSupport ? "Hide" : "Show"} support & guest cast ({totalSupport})
                    </button>

                    {showSupport && (
                        <>
                            {support.length > 0 && (
                                <>
                                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Support Role</p>
                                    <ScrollArea className="w-full whitespace-nowrap mb-4" viewportStyle={{ overflowY: "hidden" }}>
                                        <div className="flex gap-4 pb-4">
                                            {support.map((actor) => (
                                                <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </>
                            )}
                            {guest.length > 0 && (
                                <>
                                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Guest Role</p>
                                    <ScrollArea className="w-full whitespace-nowrap" viewportStyle={{ overflowY: "hidden" }}>
                                        <div className="flex gap-4 pb-4">
                                            {guest.map((actor) => (
                                                <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
                                            ))}
                                        </div>
                                        <ScrollBar orientation="horizontal" />
                                    </ScrollArea>
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
