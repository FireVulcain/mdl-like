import { mediaService } from "@/services/media.service";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default async function PhotosPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    const hasBackdrops = media.images?.backdrops && media.images.backdrops.length > 0;
    const hasPosters = media.images?.posters && media.images.posters.length > 0;

    return (
        <div className="container py-8 space-y-8 m-auto">
            {/* Header */}
            <div className="space-y-4">
                <Link href={`/media/${id}`} className="inline-flex items-center text-base text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to {media.title}
                </Link>

                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Photos</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">{media.title}</span>
                        <span>•</span>
                        <span>{media.year}</span>
                    </div>
                </div>
            </div>

            <hr className="border-border" />

            {/* Backdrops Section */}
            {hasBackdrops && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Backdrops</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {media.images?.backdrops.map((src, index) => (
                            <div
                                key={`backdrop-${index}`}
                                className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted shadow-sm group"
                            >
                                <Image
                                    src={src}
                                    alt={`Backdrop ${index + 1}`}
                                    fill
                                    className="object-cover transition-transform group-hover:scale-105"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Posters Section */}
            {hasPosters && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Posters</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {media.images?.posters.map((src, index) => (
                            <div key={`poster-${index}`} className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-muted shadow-sm group">
                                <Image
                                    src={src}
                                    alt={`Poster ${index + 1}`}
                                    fill
                                    className="object-cover transition-transform group-hover:scale-105"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!hasBackdrops && !hasPosters && <div className="text-center py-12 text-muted-foreground">No photos available.</div>}
        </div>
    );
}
