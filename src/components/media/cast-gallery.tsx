"use client";

import Image from "next/image";

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
        return <div className="text-center py-12 text-muted-foreground">No cast information available.</div>;
    }

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {cast.map((actor) => (
                <div key={actor.id} className="space-y-3 group">
                    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-shimmer shadow-sm transition-transform hover:scale-105">
                        {actor.profile ? (
                            <Image
                                src={actor.profile}
                                alt={actor.name}
                                fill
                                className="object-cover opacity-0 transition-all duration-500"
                                loading="lazy"
                                onLoad={(e) => e.currentTarget.classList.replace("opacity-0", "opacity-100")}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-base text-muted-foreground bg-secondary">
                                No Image
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="font-semibold leading-tight">{actor.name}</div>
                        <div className="text-base text-muted-foreground leading-tight mt-1">{actor.character}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}
