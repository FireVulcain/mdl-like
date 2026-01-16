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
        <div className="container py-8 space-y-6 m-auto">
            {/* Header */}
            <div className="space-y-4">
                <Link href={`/media/${id}`} className="inline-flex items-center text-base text-muted-foreground hover:text-primary transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to {media.title}
                </Link>

                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">Cast & Credits</h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="font-medium text-foreground">{media.title}</span>
                        <span>•</span>
                        <span>{media.year}</span>
                    </div>
                </div>
            </div>

            <hr className="border-border" />

            {/* Cast Grid */}
            <CastGallery cast={media.cast ?? []} />
        </div>
    );
}
