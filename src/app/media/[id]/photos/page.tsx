import { mediaService } from "@/services/media.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PhotoGallery } from "@/components/media/photo-gallery";

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

            <PhotoGallery backdrops={media.images?.backdrops || []} posters={media.images?.posters || []} />

            {!hasBackdrops && !hasPosters && <div className="text-center py-12 text-muted-foreground">No photos available.</div>}
        </div>
    );
}
