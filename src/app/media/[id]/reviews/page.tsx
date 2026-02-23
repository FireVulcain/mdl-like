import { mediaService } from "@/services/media.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMdlData } from "@/lib/mdl-data";
import { kuryanaGetReviews } from "@/lib/kuryana";
import { MdlReviews } from "@/components/media/mdl-reviews";

export default async function ReviewsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    const MDL_COUNTRIES = new Set(["KR", "CN", "JP", "TW", "TH", "HK"]);
    if (!MDL_COUNTRIES.has(media.originCountry)) {
        notFound();
    }

    const mdlData = await getMdlData(media.externalId, media.title, media.year, media.nativeTitle);
    if (!mdlData?.mdlSlug) {
        notFound();
    }

    const result = await kuryanaGetReviews(mdlData.mdlSlug);
    const reviews = result?.data?.reviews ?? [];
    const mdlLink = result?.data?.link ?? `https://mydramalist.com/search?q=${encodeURIComponent(media.title)}`;

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-8 m-auto max-w-3xl">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={`/media/${id}`} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {media.title}
                    </Link>

                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">Reviews</h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="font-medium text-white">{media.title}</span>
                            <span>•</span>
                            <span>{media.year}</span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                {reviews.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">No reviews available.</div>
                ) : (
                    <MdlReviews initialReviews={reviews} mdlSlug={mdlData.mdlSlug} mdlLink={mdlLink} />
                )}
            </div>
        </div>
    );
}
