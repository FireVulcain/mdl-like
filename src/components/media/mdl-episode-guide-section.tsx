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
    mdlSlug?: string; // When provided, skips the TMDB→MDL slug lookup (for MDL-native pages)
    mediaId?: string; // Full media ID for episode page links (e.g. "tmdb-249972")
}

const SYNOPSIS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — stable once show airs
const EMPTY_TTL_MS   =      24 * 60 * 60 * 1000;  // 24 hours — retry if MDL hadn't filled it yet

// Async server component — fetches MDL episode list + individual episode details
// (for synopsis) in parallel, then passes everything to the EpisodeGuide toggle.
// Wrapped in Suspense in the media page so the TMDB-only guide shows immediately.
export async function MdlEpisodeGuideSection({ tmdbEpisodes, season, poster, externalId, mdlSlug: directSlug, mediaId }: Props) {
    let effectiveSlug: string | null = directSlug ?? null;

    if (!effectiveSlug) {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: externalId },
            select: { mdlSlug: true, mdlDisabled: true },
        });

        if (cached?.mdlDisabled) {
            return <EpisodeGuide episodes={tmdbEpisodes} season={season} poster={poster} mdlEpisodes={null} mediaId={mediaId} />;
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

            // Determine which episodes need a fresh fetch from Kuryana
            const staleNumbers = episodeNumbers.filter((n) => {
                const row = cacheMap.get(n);
                if (!row) return true;
                const age = now - row.cachedAt.getTime();
                return age > (row.synopsis ? SYNOPSIS_TTL_MS : EMPTY_TTL_MS);
            });

            // Fetch only stale/missing episodes in parallel
            const freshDetails = staleNumbers.length
                ? await Promise.all(staleNumbers.map((n) => kuryanaGetEpisode(slug, n)))
                : [];

            // Persist freshly fetched data to DB
            if (freshDetails.length) {
                await Promise.all(
                    staleNumbers.map((n, i) => {
                        const detail = freshDetails[i];
                        return prisma.cachedMdlEpisode.upsert({
                            where: { mdlSlug_episodeNumber: { mdlSlug: slug, episodeNumber: n } },
                            create: {
                                mdlSlug: slug,
                                episodeNumber: n,
                                synopsis: detail?.data?.synopsis || null,
                                episodeTitle: detail?.data?.episode_title || null,
                            },
                            update: {
                                synopsis: detail?.data?.synopsis || null,
                                episodeTitle: detail?.data?.episode_title || null,
                                cachedAt: new Date(),
                            },
                        });
                    })
                );
            }

            const freshMap = new Map(staleNumbers.map((n, i) => [n, freshDetails[i]]));

            mdlEpisodes = listEpisodes.map((ep, i) => {
                const number = episodeNumbers[i];
                const cached = cacheMap.get(number);
                const detail = freshMap.get(number);

                // Prefer freshly fetched, fall back to DB cache
                const episodeTitle = detail?.data?.episode_title || cached?.episodeTitle || null;
                const synopsis     = detail?.data?.synopsis      || cached?.synopsis      || null;

                const title = episodeTitle ||
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
                    synopsis,
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
            mediaId={mediaId}
        />
    );
}
