import { mediaService } from "@/services/media.service";
import { prisma } from "@/lib/prisma";
import { kuryanaGetMediaPhotos } from "@/lib/kuryana";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { PhotoGallery } from "@/components/media/photo-gallery";
import { MdlPhotoGrid } from "@/components/media/mdl-photo-grid";
import type { Metadata } from "next";
import { mediaMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    return mediaMetadata((await params).id, "Photos");
}

export default async function PhotosPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ source?: string; season?: string; page?: string }>;
}) {
    const { id } = await params;
    const { source, season: rawSeason, page: rawPage } = await searchParams;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    // "View all" arrives from a section that was already showing one of the two
    // sources. Landing on the other one would be a broken promise, so the link
    // carries which it meant.
    const wantsMdl = source === "mdl";
    const season = Math.max(1, parseInt(rawSeason ?? "1", 10) || 1);
    const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

    let mdlSlug: string | null = id.startsWith("mdl-") ? id.slice(4) : null;
    if (wantsMdl && !mdlSlug) {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: media.externalId },
            select: { mdlSlug: true },
        });
        if (cached?.mdlSlug) {
            if (season === 1) {
                mdlSlug = cached.mdlSlug;
            } else {
                const seasonLink = await prisma.mdlSeasonLink.findUnique({
                    where: { tmdbExternalId_season: { tmdbExternalId: media.externalId, season } },
                });
                mdlSlug = seasonLink?.mdlSlug ?? null;
            }
        }
    }

    const mdl = wantsMdl && mdlSlug ? await kuryanaGetMediaPhotos(mdlSlug, page) : null;
    const mdlPhotos = mdl?.data?.photos ?? [];
    const totalPages = mdl?.data?.pagination?.total_pages ?? 1;
    const currentPage = mdl?.data?.pagination?.current_page ?? page;

    const hasBackdrops = media.images?.backdrops && media.images.backdrops.length > 0;
    const hasPosters = media.images?.posters && media.images.posters.length > 0;

    const pageHref = (p: number) => {
        const q = new URLSearchParams({ source: "mdl" });
        if (season > 1) q.set("season", String(season));
        if (p > 1) q.set("page", String(p));
        return `/media/${id}/photos?${q.toString()}`;
    };

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
                        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-white">Photos</h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <span className="font-medium text-white">{media.title}</span>
                            <span>•</span>
                            <span>{media.year}</span>
                            {wantsMdl && totalPages > 1 && (
                                <>
                                    <span>•</span>
                                    <span>
                                        Page {currentPage} of {totalPages}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                {wantsMdl ? (
                    <>
                        {mdlPhotos.length > 0 ? (
                            <MdlPhotoGrid photos={mdlPhotos} />
                        ) : (
                            <div className="text-center py-12 text-gray-400">No photos available on MyDramaList.</div>
                        )}

                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-3">
                                <Link
                                    href={pageHref(currentPage - 1)}
                                    aria-disabled={currentPage <= 1}
                                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                        currentPage <= 1
                                            ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                            : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                    }`}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Prev
                                </Link>
                                <span className="text-sm text-gray-500">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <Link
                                    href={pageHref(currentPage + 1)}
                                    aria-disabled={currentPage >= totalPages}
                                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                        currentPage >= totalPages
                                            ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                            : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                    }`}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <PhotoGallery backdrops={media.images?.backdrops || []} posters={media.images?.posters || []} />
                        {!hasBackdrops && !hasPosters && <div className="text-center py-12 text-gray-400">No photos available.</div>}
                    </>
                )}
            </div>
        </div>
    );
}
