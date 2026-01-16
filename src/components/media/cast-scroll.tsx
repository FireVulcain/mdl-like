"use client";

import Image from "next/image";
import Link from "next/link";

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

export function CastScroll({ cast, mediaId }: CastScrollProps) {
    if (!cast || cast.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Cast & Credits</h3>
                <Link href={`/media/${mediaId}/cast`} className="text-base text-primary hover:underline font-medium">
                    View all
                </Link>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                {cast.slice(0, 6).map((actor) => (
                    <div key={actor.id} className="flex-none w-[100px] space-y-2">
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-shimmer">
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
                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                                    No Image
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="text-base font-medium truncate" title={actor.name}>
                                {actor.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={actor.character}>
                                {actor.character}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
