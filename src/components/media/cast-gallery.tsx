"use client";

import Image from "next/image";
import Link from "next/link";

interface Actor {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

interface CastGalleryProps {
    cast: Actor[];
}

export function CastGallery({ cast }: CastGalleryProps) {
    if (!cast || cast.length === 0) {
        return <div className="text-center py-12 text-gray-400">No cast information available.</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {cast.map((actor) => (
                <Link key={actor.id} href={`/cast/${actor.id}`} className="space-y-3 group block">
                    <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer shadow-lg ring-2 ring-white/10 hover:ring-white/20 transition-all hover:scale-105">
                        {actor.profile ? (
                            <Image unoptimized={true}
                                src={actor.profile}
                                alt={actor.name}
                                fill className="object-cover opacity-0 transition-opacity duration-700 ease-out"
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
                            <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-linear-to-br from-gray-800 to-gray-900">
                                No Image
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="font-semibold leading-tight text-white group-hover:text-blue-400 transition-colors">{actor.name}</div>
                        <div className="text-sm text-gray-400 leading-tight mt-1">{actor.character}</div>
                    </div>
                </Link>
            ))}
        </div>
    );
}
