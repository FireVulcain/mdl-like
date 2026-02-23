import { getMdlData } from "@/lib/mdl-data";
import { kuryanaGetReviews } from "@/lib/kuryana";
import { MdlReviews } from "./mdl-reviews";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    mediaId: string;
}

// Async server component — streams in MDL reviews.
// getMdlData uses React cache(), so the slug lookup is free if MdlSection already resolved it.
export async function MdlReviewsSection({ externalId, title, year, nativeTitle, mediaId }: Props) {
    const mdlData = await getMdlData(externalId, title, year, nativeTitle);
    if (!mdlData?.mdlSlug) return null;

    const result = await kuryanaGetReviews(mdlData.mdlSlug);
    const reviews = result?.data?.reviews ?? [];
    const mdlLink = result?.data?.link ?? `https://mydramalist.com/search?q=${encodeURIComponent(title)}`;

    if (reviews.length === 0) return null;

    return (
        <MdlReviews
            initialReviews={reviews}
            mdlSlug={mdlData.mdlSlug}
            mdlLink={mdlLink}
            previewLimit={3}
            allReviewsHref={`/media/${mediaId}/reviews`}
        />
    );
}
