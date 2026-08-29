import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { kuryanaGetPersonPhotos } from "@/lib/kuryana";
import { MdlPhotoGrid } from "@/components/media/mdl-photo-grid";
import type { Metadata } from "next";
import { mdlPersonMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    return mdlPersonMetadata((await params).slug, "Photos");
}

export default async function PersonPhotosPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ page?: string }>;
}) {
    const { slug } = await params;
    const { page: rawPage } = await searchParams;
    const page = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);

    // A null result means the scrape failed or timed out, which is not the same
    // as "no such person" — the page still renders, with an empty state, so a
    // slow scraper never turns a valid URL into a 404.
    const res = await kuryanaGetPersonPhotos(slug, page);

    const title = res?.data?.title || "this person";
    const photos = res?.data?.photos ?? [];
    const totalPages = res?.data?.pagination?.total_pages ?? 1;
    const currentPage = res?.data?.pagination?.current_page ?? page;

    const pageHref = (p: number) => (p <= 1 ? `/people/${slug}/photos` : `/people/${slug}/photos?page=${p}`);

    return (
        <div className="min-h-screen">
            <div className="container py-8 space-y-8 m-auto">
                <div className="space-y-4">
                    <Link
                        href={`/people/${slug}`}
                        className="inline-flex items-center text-sm text-sky-400 hover:text-sky-300 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {title}
                    </Link>

                    <div>
                        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-fg">Photos</h1>
                        <div className="flex items-center gap-2 text-fg-muted">
                            <span className="font-medium text-fg">{title}</span>
                            {totalPages > 1 && (
                                <>
                                    <span>·</span>
                                    <span>
                                        Page {currentPage} of {totalPages}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="h-px bg-surface-3" />

                {photos.length > 0 ? (
                    <MdlPhotoGrid photos={photos} />
                ) : (
                    <div className="text-center py-12 text-fg-muted">No photos available.</div>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3">
                        <Link
                            href={pageHref(currentPage - 1)}
                            aria-disabled={currentPage <= 1}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-line-strong ${
                                currentPage <= 1
                                    ? "opacity-30 pointer-events-none bg-surface-1 text-fg-dim"
                                    : "bg-surface-2 text-fg-soft hover:bg-surface-4 hover:text-fg"
                            }`}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Prev
                        </Link>
                        <span className="text-sm text-fg-dim">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Link
                            href={pageHref(currentPage + 1)}
                            aria-disabled={currentPage >= totalPages}
                            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-line-strong ${
                                currentPage >= totalPages
                                    ? "opacity-30 pointer-events-none bg-surface-1 text-fg-dim"
                                    : "bg-surface-2 text-fg-soft hover:bg-surface-4 hover:text-fg"
                            }`}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
