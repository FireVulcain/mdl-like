import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisodesList, kuryanaGetEpisode } from "@/lib/kuryana";
import { EpisodeGuide, type MdlEpisodeItem } from "./episode-guide";
import { MdlSeasonLinkButton } from "./mdl-season-link-button";

interface TmdbEpisode {
    id: number;
    number: number;
    name: string;
    overview: string;
    airDate: string | null;
    still: string | null;
    runtime: number | null;
    rating: number;
}

interface Props {
    tmdbEpisodes: TmdbEpisode[];
    season: number;
    poster: string | null;
    externalId: string;
    mediaId: string;
    title: string;
}

// Async server component — fetches MDL episode list + individual episode details
// (for synopsis) in parallel, then passes everything to the EpisodeGuide toggle.
// Wrapped in Suspense in the media page so the TMDB-only guide shows immediately.
export async function MdlEpisodeGuideSection({ tmdbEpisodes, season, poster, externalId, mediaId, title }: Props) {
    const cached = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId: externalId },
        select: { mdlSlug: true },
    });

    // Seasons 2+ require a manually linked slug (stored in MdlSeasonLink).
    // Season 1 uses the base slug from CachedMdlData.
    let effectiveSlug: string | null = null;
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

    let mdlEpisodes: MdlEpisodeItem[] | null = null;

    if (effectiveSlug) {
        const list = await kuryanaGetEpisodesList(effectiveSlug);
        if (list?.data?.episodes?.length) {
            const listEpisodes = list.data.episodes;
            const showTitle = list.data.title;

            // Fetch all individual episode details in parallel for synopsis + episode titles
            const details = await Promise.all(
                listEpisodes.map((ep, i) => {
                    const numMatch = ep.link.match(/\/episode\/(\d+)/);
                    const number = numMatch ? parseInt(numMatch[1]) : i + 1;
                    return kuryanaGetEpisode(effectiveSlug!, number);
                })
            );

            mdlEpisodes = listEpisodes.map((ep, i) => {
                const numMatch = ep.link.match(/\/episode\/(\d+)/);
                const number = numMatch ? parseInt(numMatch[1]) : i + 1;

                const detail = details[i];

                // Prefer episode_title from detail (e.g. "Feud"); fall back to
                // stripping the show name from the list title ("Episode 1")
                const title = detail?.data?.episode_title ||
                    (ep.title.startsWith(showTitle)
                        ? ep.title.slice(showTitle.length).trim()
                        : ep.title);

                // Parse list rating as fallback: "9.3/10 from 233 users" → 9.3
                const ratingMatch = ep.rating.match(/^([\d.]+)\//);
                const rating = detail?.data?.rating ?? (ratingMatch ? parseFloat(ratingMatch[1]) : null);

                return {
                    number,
                    title,
                    image: ep.image || null,
                    airDate: ep.air_date || null,
                    rating,
                    synopsis: detail?.data?.synopsis || null,
                };
            });
        }
    }

    // Show a link button for seasons 2+ that haven't been linked yet
    const showLinkButton = season > 1 && !!cached?.mdlSlug && !effectiveSlug;

    return (
        <div className="space-y-3">
            <EpisodeGuide
                episodes={tmdbEpisodes}
                season={season}
                poster={poster}
                mdlEpisodes={mdlEpisodes}
            />
            {showLinkButton && (
                <MdlSeasonLinkButton
                    tmdbExternalId={externalId}
                    season={season}
                    mediaId={mediaId}
                    title={title}
                />
            )}
        </div>
    );
}
