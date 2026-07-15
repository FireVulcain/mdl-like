import { after } from "next/server";
import { tmdb } from "@/lib/tmdb";
import { tvmaze, NextEpisodeResult } from "@/lib/tvmaze";
import { kuryanaGetNextEpisode } from "@/lib/kuryana";
import { upsertCachedNextEpisode } from "@/lib/next-episode-cache";

/**
 * TVmaze name lookup that copes with MDL naming: MDL lists each season as its
 * own show ("Love Class Season 3") while TVmaze has one show with seasons
 * ("Love Class"), so on a miss retry with the "Season N"/"Part N" suffix
 * stripped. TVmaze then reports the show-level next episode, which is exactly
 * what we want to display.
 */
async function getNextEpisodeByNameLoose(title: string): Promise<NextEpisodeResult | null> {
    const found = await tvmaze.getNextEpisodeByName(title);
    if (found) return found;

    const baseTitle = title.replace(/\s+(?:season|part)\s*\d+$/i, "").trim();
    if (!baseTitle || baseTitle === title) return null;
    return tvmaze.getNextEpisodeByName(baseTitle);
}

/**
 * Next-episode waterfall shared by the /api/next-episodes route and the home
 * page prefill. MDL first when a slug is known — it's the authoritative source
 * for Asian dramas and carries the EXACT broadcast time (TVmaze/TMDB only know
 * the date, and often lag). Then with a TMDB id: TVmaze by IMDB → TVDB → name,
 * then TMDB's own next_episode_to_air. Without one: TVmaze by name only.
 */
export async function fetchNextEpisodeFromApis(item: {
    tmdbId?: string;
    title: string;
    mdlSlug?: string | null;
    season?: number;
}): Promise<NextEpisodeResult | null> {
    if (item.mdlSlug) {
        try {
            const mdlNext = await kuryanaGetNextEpisode(item.mdlSlug);
            if (mdlNext) {
                return {
                    airDate: mdlNext.airDate,
                    airDateTime: mdlNext.airDateTime,
                    episodeNumber: mdlNext.episodeNumber,
                    // The MDL entry IS the requested season's entity (one entry per season)
                    seasonNumber: item.season ?? 1,
                    name: "",
                    seasonEpisodeCount: mdlNext.totalEpisodes ?? undefined,
                };
            }
        } catch {
            // fall through to TVmaze/TMDB
        }
    }

    try {
        if (!item.tmdbId) {
            return item.title ? await getNextEpisodeByNameLoose(item.title) : null;
        }

        const [details, externalIds] = await Promise.all([
            tmdb.getDetails("tv", item.tmdbId),
            tmdb.getExternalIds("tv", item.tmdbId),
        ]);

        let nextEpisode: NextEpisodeResult | null = null;

        if (externalIds?.imdb_id) {
            nextEpisode = await tvmaze.getNextEpisodeByImdb(externalIds.imdb_id);
        }
        if (!nextEpisode && externalIds?.tvdb_id) {
            nextEpisode = await tvmaze.getNextEpisodeByTvdb(externalIds.tvdb_id);
        }
        if (!nextEpisode && item.title) {
            nextEpisode = await getNextEpisodeByNameLoose(item.title);
        }

        if (!nextEpisode && details.next_episode_to_air) {
            nextEpisode = {
                airDate: details.next_episode_to_air.air_date,
                episodeNumber: details.next_episode_to_air.episode_number,
                seasonNumber: details.next_episode_to_air.season_number,
                name: details.next_episode_to_air.name,
            };
        }

        return nextEpisode;
    } catch {
        return null;
    }
}

/**
 * Fill the CachedEpisode table for shows missing from it, AFTER the response
 * has been sent (Next's `after`) so page render latency is unaffected. The
 * next page load then reads the fresh cache. Bounded and throttled to stay
 * polite with TVmaze; shows with no findable episode are simply retried on a
 * later visit.
 */
export function prefillNextEpisodes(
    items: Array<{ cacheKey: string; tmdbId?: string; title: string; mdlSlug?: string | null; season?: number }>,
    limit = 6,
) {
    if (items.length === 0) return;

    after(async () => {
        for (const item of items.slice(0, limit)) {
            try {
                const ep = await fetchNextEpisodeFromApis(item);
                if (ep) {
                    await upsertCachedNextEpisode({
                        mediaId: item.cacheKey,
                        airDate: ep.airDate,
                        airDateTime: ep.airDateTime ?? null,
                        episodeNumber: ep.episodeNumber,
                        seasonNumber: ep.seasonNumber,
                        episodeName: ep.name ?? null,
                    });
                }
            } catch {
                // best effort — next visit retries
            }
            await new Promise((r) => setTimeout(r, 200));
        }
    });
}
