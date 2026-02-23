import { mediaService } from "@/services/media.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getMdlData } from "@/lib/mdl-data";
import { kuryanaGetReviews } from "@/lib/kuryana";
import { MdlReviews } from "@/components/media/mdl-reviews";
import { Suspense } from "react";

function ReviewsSkeleton() {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-3 animate-pulse">
                    <div className="flex items-center gap-2.5">
                        <div className="size-8 rounded-full bg-white/10 shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 w-28 rounded bg-white/10" />
                            <div className="h-3 w-20 rounded bg-white/5" />
                        </div>
                        <div className="h-6 w-12 rounded-lg bg-yellow-400/10 shrink-0" />
                    </div>
                    <div className="space-y-2">
                        <div className="h-3 w-full rounded bg-white/8" />
                        <div className="h-3 w-4/5 rounded bg-white/8" />
                        <div className="h-3 w-3/5 rounded bg-white/5" />
                    </div>
                </div>
            ))}
        </div>
    );
}

async function ReviewsData({ externalId, title, year, nativeTitle, mdlLink: fallbackMdlLink }: {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    mdlLink: string;
}) {
    const mdlData = await getMdlData(externalId, title, year, nativeTitle);
    if (!mdlData?.mdlSlug) {
        return <div className="text-center py-12 text-gray-400">No MDL data found for this title.</div>;
    }

    const result = await kuryanaGetReviews(mdlData.mdlSlug);
    const reviews = result?.data?.reviews ?? [];
    const mdlLink = result?.data?.link ?? fallbackMdlLink;

    if (reviews.length === 0) {
        return <div className="text-center py-12 text-gray-400">No reviews available.</div>;
    }

    return <MdlReviews initialReviews={reviews} mdlSlug={mdlData.mdlSlug} mdlLink={mdlLink} />;
}

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

    const fallbackMdlLink = `https://mydramalist.com/search?q=${encodeURIComponent(media.title)}`;

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-8 m-auto max-w-3xl">
                {/* Header — renders immediately */}
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

                {/* Reviews — streams in after MDL + Kuryana resolve */}
                <Suspense fallback={<ReviewsSkeleton />}>
                    <ReviewsData
                        externalId={media.externalId}
                        title={media.title}
                        year={media.year}
                        nativeTitle={media.nativeTitle}
                        mdlLink={fallbackMdlLink}
                    />
                </Suspense>
            </div>
        </div>
    );
}
