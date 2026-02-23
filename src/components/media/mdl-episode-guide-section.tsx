import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisodesList, kuryanaGetEpisode } from "@/lib/kuryana";
import { EpisodeGuide, type MdlEpisodeItem } from "./episode-guide";

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
}

// Async server component — fetches MDL episode list + individual episode details
// (for synopsis) in parallel, then passes everything to the EpisodeGuide toggle.
// Wrapped in Suspense in the media page so the TMDB-only guide shows immediately.
export async function MdlEpisodeGuideSection({ tmdbEpisodes, season, poster, externalId }: Props) {
    const cached = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId: externalId },
        select: { mdlSlug: true },
    });

    let mdlEpisodes: MdlEpisodeItem[] | null = null;

    if (cached?.mdlSlug) {
        const list = await kuryanaGetEpisodesList(cached.mdlSlug);
        if (list?.data?.episodes?.length) {
            const listEpisodes = list.data.episodes;
            const showTitle = list.data.title;

            // Fetch all individual episode details in parallel for synopsis + episode titles
            const details = await Promise.all(
                listEpisodes.map((ep, i) => {
                    const numMatch = ep.link.match(/\/episode\/(\d+)/);
                    const number = numMatch ? parseInt(numMatch[1]) : i + 1;
                    return kuryanaGetEpisode(cached.mdlSlug!, number);
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

    return (
        <EpisodeGuide
            episodes={tmdbEpisodes}
            season={season}
            poster={poster}
            mdlEpisodes={mdlEpisodes}
        />
    );
}
