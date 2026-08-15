import { prisma } from "@/lib/prisma";
import { kuryanaGetMediaPhotos } from "@/lib/kuryana";
import { PhotosScroll } from "./photos-scroll";

interface Props {
    backdrops: string[];
    externalId: string;
    season: number;
    mediaId: string;
    /** Given on MDL-native pages, where the slug needs no lookup. */
    mdlSlug?: string;
}

/**
 * Resolves the MDL slug for this title and season, then hands both photo sets to
 * the client. Same shape as MdlRecsSection, and it streams in its own Suspense
 * boundary for the same reason: the scrape costs a few hundred milliseconds, and
 * nothing else on the page should wait on a gallery near the bottom of it.
 *
 * Failure is silent — a null result leaves the section showing TMDB backdrops,
 * which is what it showed before MDL was an option at all.
 */
export async function MdlPhotosSection({ backdrops, externalId, season, mediaId, mdlSlug: directSlug }: Props) {
    let effectiveSlug: string | null = directSlug ?? null;

    if (!effectiveSlug) {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: externalId },
            select: { mdlSlug: true },
        });

        if (cached?.mdlSlug) {
            if (season === 1) {
                effectiveSlug = cached.mdlSlug;
            } else {
                const seasonLink = await prisma.mdlSeasonLink.findUnique({
                    where: { tmdbExternalId_season: { tmdbExternalId: externalId, season } },
                });
                effectiveSlug = seasonLink?.mdlSlug ?? null;
            }
        }
    }

    const res = effectiveSlug ? await kuryanaGetMediaPhotos(effectiveSlug) : null;

    return <PhotosScroll backdrops={backdrops} mdlPhotos={res?.data?.photos ?? null} mediaId={mediaId} season={season} />;
}
