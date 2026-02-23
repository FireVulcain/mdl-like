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
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container py-8 space-y-8 m-auto">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={`/media/${id}`} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {media.title}
                    </Link>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Photos</h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="font-medium text-white">{media.title}</span>
                            <span>•</span>
                            <span>{media.year}</span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                <PhotoGallery backdrops={media.images?.backdrops || []} posters={media.images?.posters || []} />

                {!hasBackdrops && !hasPosters && <div className="text-center py-12 text-gray-400">No photos available.</div>}
            </div>
        </div>
    );
}
