import Link from "next/link";
import { kuryanaGetPersonPhotos } from "@/lib/kuryana";
import { PersonPhotoGrid } from "@/components/people/person-photo-grid";

// One row's worth on the page itself. A prolific actor has two hundred photos
// across seven pages, so the section shows the first few and hands the rest to
// its own page — the same split the media pages use for cast and photos.
const PREVIEW_COUNT = 12;

export async function PersonPhotosSection({ slug }: { slug: string }) {
    const res = await kuryanaGetPersonPhotos(slug);
    const photos = res?.data?.photos ?? [];
    if (photos.length === 0) return null;

    const totalPages = res?.data?.pagination?.total_pages ?? 1;
    const hasMore = totalPages > 1 || photos.length > PREVIEW_COUNT;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <h3 className="font-display text-lg font-semibold text-white">Photos</h3>
                <div className="flex-1 h-px bg-white/8" />
                {hasMore && (
                    <Link
                        href={`/people/${slug}/photos`}
                        className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium"
                    >
                        View all →
                    </Link>
                )}
            </div>

            <PersonPhotoGrid photos={photos.slice(0, PREVIEW_COUNT)} />
        </div>
    );
}
