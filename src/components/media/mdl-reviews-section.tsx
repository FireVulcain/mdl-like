import { getMdlData } from "@/lib/mdl-data";
import { kuryanaGetReviews } from "@/lib/kuryana";
import { MdlReviews } from "./mdl-reviews";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    mediaId: string;
    mdlSlug?: string; // When provided, skips the TMDB→MDL slug lookup (for MDL-native pages)
}

// Async server component — streams in MDL reviews.
// getMdlData uses React cache(), so the slug lookup is free if MdlSection already resolved it.
export async function MdlReviewsSection({ externalId, title, year, nativeTitle, mediaId, mdlSlug: directSlug }: Props) {
    const slug = directSlug ?? (await getMdlData(externalId, title, year, nativeTitle))?.mdlSlug;
    if (!slug) return null;

    const result = await kuryanaGetReviews(slug);
    const reviews = result?.data?.reviews ?? [];
    const mdlLink = result?.data?.link ?? `https://mydramalist.com/search?q=${encodeURIComponent(title)}`;

    if (reviews.length === 0) return null;

    return (
        <MdlReviews
            initialReviews={reviews}
            mdlSlug={slug}
            mdlLink={mdlLink}
            previewLimit={3}
            allReviewsHref={`/media/${mediaId}/reviews`}
        />
    );
}
