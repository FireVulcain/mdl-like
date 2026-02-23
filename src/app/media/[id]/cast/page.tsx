import { mediaService } from "@/services/media.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CastGallery } from "@/components/media/cast-gallery";

export default async function CastPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-6 m-auto">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={`/media/${id}`} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {media.title}
                    </Link>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Cast & Credits</h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="font-medium text-white">{media.title}</span>
                            <span>•</span>
                            <span>{media.year}</span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                {/* Cast Grid */}
                <CastGallery cast={media.cast ?? []} />
            </div>
        </div>
    );
}
