"use client";

import Image from "next/image";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface PhotosScrollProps {
    backdrops: string[];
    mediaId: string;
}

export function PhotosScroll({ backdrops, mediaId }: PhotosScrollProps) {
    if (!backdrops || backdrops.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Photos</h3>
                <Link href={`/media/${mediaId}/photos`} className="text-base text-primary hover:underline font-medium">
                    View all
                </Link>
            </div>

            <ScrollArea className="w-full whitespace-nowrap rounded-md">
                <div className="flex w-max space-x-4 pb-4">
                    {backdrops.slice(0, 6).map((src, index) => (
                        <div key={index} className="w-[200px] sm:w-[280px]">
                            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-shimmer">
                                <Image
                                    src={src}
                                    alt={`Photo ${index + 1}`}
                                    fill
                                    className="object-cover opacity-0 transition-all duration-500"
                                    loading="lazy"
                                    onLoad={(e) => e.currentTarget.classList.replace("opacity-0", "opacity-100")}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
