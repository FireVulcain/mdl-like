"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MdlCast, MdlCastMember } from "@/actions/mdl";

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

function normalizeName(name: string): string {
    return name.toLowerCase().replace(/[\s\-.']/g, "");
}

function mdlPersonSlug(slug: string): string | null {
    const match = slug.match(/\/people\/(.+)$/);
    return match ? match[1] : null;
}

function ActorCard({ actor, tmdbId }: { actor: MdlCastMember; tmdbId?: number }) {
    const href = tmdbId ? `/cast/${tmdbId}` : actor.slug ? `/people/${mdlPersonSlug(actor.slug)}` : null;

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

const CAST_GRID = "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-4";

export function MdlCastScroll({ cast, tmdbCast, mediaId }: MdlCastScrollProps) {
    const [showSupport, setShowSupport] = useState(false);
    const [source, setSource] = useState<"mdl" | "tmdb">("mdl");

    const { main, support, guest } = cast;
    const totalSupport = support.length + guest.length;

    if (main.length === 0 && totalSupport === 0) return null;

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
                    <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                            source === "mdl"
                                ? "bg-sky-500/15 text-sky-400 border-sky-500/20"
                                : "bg-white/5 text-gray-400 border-white/10"
                        }`}
                    >
                        via {source === "mdl" ? "MDL" : "TMDB"}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {tmdbCast.length > 0 && (
                        <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5 gap-0.5">
                            <button
                                onClick={() => setSource("mdl")}
                                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                                    source === "mdl" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                MDL
                            </button>
                            <button
                                onClick={() => setSource("tmdb")}
                                className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                                    source === "tmdb" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
                                }`}
                            >
                                TMDB
                            </button>
                        </div>
                    )}
                    <Link href={`/media/${mediaId}/cast`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">
                        View all →
                    </Link>
                </div>
            </div>

            {/* TMDB view */}
            {source === "tmdb" && (
                <div className={CAST_GRID}>
                    {tmdbCast.slice(0, 12).map((actor) => (
                        <Link key={actor.id} href={`/cast/${actor.id}`} className="space-y-2 group">
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
                                    <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
                                ))}
                            </div>
                        </>
                    )}

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
                                            <div className={`${CAST_GRID} mb-6`}>
                                                {support.map((actor) => (
                                                    <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {guest.length > 0 && (
                                        <>
                                            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Guest Role</p>
                                            <div className={CAST_GRID}>
                                                {guest.map((actor) => (
                                                    <ActorCard key={actor.slug} actor={actor} tmdbId={getTmdbId(actor.name)} />
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
