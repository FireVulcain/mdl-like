import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UnifiedMedia } from "@/services/media.service";
import Image from "next/image";

import { Star } from "lucide-react";

interface MediaCardProps {
    media: UnifiedMedia;
    className?: string;
    overlay?: React.ReactNode;
    sizes?: string;
    mdlRating?: number;
}

export function MediaCard({
    media,
    className,
    overlay,
    sizes = "(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw",
    mdlRating,
}: MediaCardProps) {
    return (
        <Link href={`/media/${media.id}`} className={cn("group block", className)}>
            <Card className="overflow-hidden border-0 bg-transparent shadow-none transition-transform duration-300 group-hover:scale-105">
                <div className="relative aspect-2/3 w-full overflow-hidden rounded-md bg-secondary">
                    {media.poster ? (
                        <Image unoptimized={true}
                            src={media.poster}
                            alt={media.title}
                            fill className="object-cover transition-opacity duration-300 group-hover:opacity-80"
                            sizes={sizes}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400 text-sm">
                            No Poster
                        </div>
                    )}
                    <div className="absolute right-2 top-2">
                        <Badge variant="secondary" className="bg-black/60 font-mono text-xs text-white backdrop-blur-sm">
                            {media.originCountry}
                        </Badge>
                    </div>
                    {/* Rating Badges */}
                    {(media.rating > 0 || (mdlRating != null && mdlRating > 0)) && (
                        <div className="absolute left-2 top-2 flex flex-row gap-1">
                            {media.rating > 0 && (
                                <Badge variant="default" className="bg-yellow-500/90 text-black hover:bg-yellow-500 text-xs px-1.5 flex items-center">
                                    <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                    {media.rating.toFixed(1)}
                                </Badge>
                            )}
                            {mdlRating != null && mdlRating > 0 && (
                                <Badge variant="default" className="bg-sky-500/90 text-white hover:bg-sky-500 text-xs px-1.5 flex items-center">
                                    <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                    {mdlRating.toFixed(1)}
                                </Badge>
                            )}
                        </div>
                    )}
                    {overlay}
                </div>
                <CardContent className="p-2">
                    <h3 className="line-clamp-1 font-semibold leading-tight text-foreground transition-colors group-hover:text-primary">
                        {media.title}
                    </h3>
                    <p className="text-base text-muted-foreground">
                        {media.year} • {media.type}
                    </p>
                </CardContent>
            </Card>
        </Link>
    );
}
