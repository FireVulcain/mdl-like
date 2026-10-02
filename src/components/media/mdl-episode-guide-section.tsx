import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisodesList } from "@/lib/kuryana";
import { EMPTY_SYNOPSIS_TTL_MS, isUnaired } from "@/lib/mdl-episodes";
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
    mdlSlug?: string; // When provided, skips the TMDB→MDL slug lookup (for MDL-native pages)
    mediaId?: string; // Full media ID for episode page links (e.g. "tmdb-249972")
    watchedProgress?: number;
    hideSpoilers?: boolean;
}

// Async server component — one call for MDL's episode list, then synopses from
// the database only. An episode without one gets a "Show synopsis" link that
// reads that single episode on demand (loadEpisodeSynopsis): the guide used to
// scrape every episode's page up front, 1 + N calls per first visit, for a
// list that shows four rows until it is expanded.
// Wrapped in Suspense in the media page so the TMDB-only guide shows immediately.
export async function MdlEpisodeGuideSection({ tmdbEpisodes, season, poster, externalId, mdlSlug: directSlug, mediaId, watchedProgress, hideSpoilers }: Props) {
    let effectiveSlug: string | null = directSlug ?? null;

    if (!effectiveSlug) {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: externalId },
            select: { mdlSlug: true, mdlDisabled: true },
        });

        if (cached?.mdlDisabled) {
            return <EpisodeGuide episodes={tmdbEpisodes} season={season} poster={poster} mdlEpisodes={null} mediaId={mediaId} watchedProgress={watchedProgress} hideSpoilers={hideSpoilers} />;
        }

        // Seasons 2+ require a manually linked slug (stored in MdlSeasonLink).
        // Season 1 uses the base slug from CachedMdlData.
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

    let mdlEpisodes: MdlEpisodeItem[] | null = null;

    if (effectiveSlug) {
        const list = await kuryanaGetEpisodesList(effectiveSlug);
        if (list?.data?.episodes?.length) {
            const listEpisodes = list.data.episodes;
            const showTitle = list.data.title;
            const slug = effectiveSlug;

            // Extract episode numbers from list links
            const episodeNumbers = listEpisodes.map((ep, i) => {
                const m = ep.link.match(/\/episode\/(\d+)/);
                return m ? parseInt(m[1]) : i + 1;
            });

            // One query to get all cached episodes for this slug
            const now = Date.now();
            const cachedRows = await prisma.cachedMdlEpisode.findMany({
                where: { mdlSlug: slug, episodeNumber: { in: episodeNumbers } },
            });
            const cacheMap = new Map(cachedRows.map((r) => [r.episodeNumber, r]));

            mdlEpisodes = listEpisodes.map((ep, i) => {
                const number = episodeNumbers[i];
                const cached = cacheMap.get(number);
                const synopsis = cached?.synopsis?.trim() || null;
                const episodeTitle = cached?.episodeTitle || null;

                const title = episodeTitle ||
                    (ep.title.startsWith(showTitle)
                        ? ep.title.slice(showTitle.length).trim()
                        : ep.title);

                // Parse list rating: "9.3/10 from 233 users" → 9.3
                const ratingMatch = ep.rating.match(/^([\d.]+)\//);
                const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

                const synopsisState: MdlEpisodeItem["synopsisState"] = synopsis
                    ? "known"
                    : isUnaired(ep.air_date, now)
                      ? "unaired"
                      : cached && now - cached.cachedAt.getTime() < EMPTY_SYNOPSIS_TTL_MS
                        ? "none"
                        : "ask";

                return {
                    number,
                    title,
                    image: ep.image || null,
                    airDate: ep.air_date || null,
                    rating,
                    synopsis,
                    synopsisState,
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
            mdlSlug={effectiveSlug}
            mediaId={mediaId}
            watchedProgress={watchedProgress}
            hideSpoilers={hideSpoilers}
        />
    );
}
