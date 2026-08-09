"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MdlCast, MdlCastMember } from "@/actions/mdl";
import { mdlPersonHref, tmdbPersonHref } from "@/lib/person-links";
import { SourceToggle } from "@/components/media/source-toggle";

interface TmdbActor {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

interface MdlCastScrollProps {
    cast: MdlCast;
    tmdbCast: TmdbActor[];
    mediaId: string;
}

function ActorCard({ actor }: { actor: MdlCastMember }) {
    // MDL cast always links to the MDL person page. Routing on a TMDB name match
    // made two actors of the same show land on different routes depending on
    // whether TMDB spelled the name the same way.
    const href = mdlPersonHref(actor.slug);

    const inner = (
        <div className="space-y-2 group cursor-pointer">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer hover:scale-105">
                {actor.profileImage ? (
                    <Image
                        unoptimized={true}
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
                <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors leading-snug">
                    {actor.name}
                </div>
                <div className="text-xs text-gray-400 leading-snug mt-0.5">
                    {actor.characterName}
                </div>
            </div>
        </div>
    );

    if (href) {
        return <Link href={href}>{inner}</Link>;
    }

    return <div>{inner}</div>;
}

const CAST_GRID = "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4";

export function MdlCastScroll({ cast, tmdbCast, mediaId }: MdlCastScrollProps) {
    const [showSupport, setShowSupport] = useState(false);
    const [source, setSource] = useState<"mdl" | "tmdb">("mdl");

    const { main, support, guest, cameo } = cast;
    const totalSupport = support.length + guest.length + cameo.length;

    if (main.length === 0 && totalSupport === 0) return null;

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold text-white">Cast</h3>
                <div className="flex items-center gap-3">
                    {tmdbCast.length > 0 && (
                        <SourceToggle value={source} onChange={setSource} />
                    )}
                    <Link href={`/media/${mediaId}/cast`} className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium">
                        View all →
                    </Link>
                </div>
            </div>

            {/* TMDB view */}
            {source === "tmdb" && (
                <div className={CAST_GRID}>
                    {tmdbCast.slice(0, 12).map((actor) => (
                        <Link key={actor.id} href={tmdbPersonHref(actor.id)} className="space-y-2 group">
                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer hover:scale-105">
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
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 p-1 text-center bg-linear-to-br from-gray-800 to-gray-900">
                                        No Image
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors leading-snug">
                                    {actor.name}
                                </div>
                                <div className="text-xs text-gray-400 leading-snug mt-0.5">
                                    {actor.character}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* MDL view */}
            {source === "mdl" && (
                <>
                    {main.length > 0 && (
                        <>
                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Main Role</p>
                            <div className={`${CAST_GRID} mb-6`}>
                                {main.map((actor) => (
                                    <ActorCard key={actor.slug} actor={actor} />
                                ))}
                            </div>
                        </>
                    )}

                    {totalSupport > 0 && (
                        <>
                            <button
                                onClick={() => setShowSupport((v) => !v)}
                                className="cursor-pointer flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors mb-3"
                            >
                                {showSupport ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                {showSupport ? "Hide" : "Show"} support, guest & cameo cast ({totalSupport})
                            </button>

                            {showSupport && (
                                <>
                                    {support.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Support Role</p>
                                            <div className={`${CAST_GRID} mb-6`}>
                                                {support.map((actor) => (
                                                    <ActorCard key={actor.slug} actor={actor} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {guest.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Guest Role</p>
                                            <div className={`${CAST_GRID} mb-6`}>
                                                {guest.map((actor) => (
                                                    <ActorCard key={actor.slug} actor={actor} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {cameo.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Cameo</p>
                                            <div className={CAST_GRID}>
                                                {cameo.map((actor) => (
                                                    <ActorCard key={actor.slug} actor={actor} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </>
            )}
        </div>
    );
}
