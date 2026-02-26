"use client";

import Image from "next/image";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

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
                <h3 className="text-lg font-semibold text-white">Cast & Credits</h3>
                <Link href={`/media/${mediaId}/cast`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    View all →
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 pb-4">
                    {cast.slice(0, 6).map((actor) => (
                        <Link key={actor.id} href={`/cast/${actor.id}`} className="flex-none w-25 space-y-2 group">
                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg ring-2 ring-white/10 hover:ring-white/20 transition-all shadow-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer hover:scale-105">
                                {actor.profile ? (
                                    <Image
                                        src={actor.profile}
                                        alt={actor.name}
                                        fill
                                        unoptimized={true}
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
                                <div
                                    className="text-sm font-medium truncate text-white group-hover:text-blue-400 transition-colors"
                                    title={actor.name}
                                >
                                    {actor.name}
                                </div>
                                <div className="text-xs text-gray-400 truncate" title={actor.character}>
                                    {actor.character}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
