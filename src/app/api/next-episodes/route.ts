import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { tmdb } from "@/lib/tmdb";
import { tvmaze } from "@/lib/tvmaze";
import { getCachedNextEpisodes, upsertCachedNextEpisode } from "@/lib/next-episode-cache";

export const maxDuration = 30;

type RequestItem = {
    tmdbId: string;
    season: number;
    title: string;
};

type NextEpisodeResult = {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
    seasonEpisodeCount?: number;
} | null;

async function fetchFromApis(item: RequestItem): Promise<NextEpisodeResult> {
    try {
        const [details, externalIds] = await Promise.all([
            tmdb.getDetails("tv", item.tmdbId),
            tmdb.getExternalIds("tv", item.tmdbId),
        ]);

        let nextEpisode: NextEpisodeResult = null;

        // TVMaze waterfall: IMDB → TVDB → name
        if (externalIds?.imdb_id) {
            nextEpisode = await tvmaze.getNextEpisodeByImdb(externalIds.imdb_id);
        }
        if (!nextEpisode && externalIds?.tvdb_id) {
            nextEpisode = await tvmaze.getNextEpisodeByTvdb(externalIds.tvdb_id);
        }
        if (!nextEpisode && item.title) {
            nextEpisode = await tvmaze.getNextEpisodeByName(item.title);
        }

        // TMDB fallback
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

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id && process.env.SKIP_AUTH !== "true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let items: RequestItem[];
    try {
        const body = await req.json();
        items = body.items ?? [];
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({});
    }

    // Check DB cache for all requested items in one query
    const cacheKeys = items.map((i) => ({ mediaId: i.tmdbId, seasonNumber: i.season }));
    const cached = await getCachedNextEpisodes(cacheKeys);

    const result: Record<string, NextEpisodeResult> = {};
    const missItems: RequestItem[] = [];

    for (const item of items) {
        const key = `${item.tmdbId}-${item.season}`;
        const hit = cached.get(key);
        if (hit?.fresh) {
            // Warm cache hit — return immediately, no external call needed
            result[key] = {
                airDate: hit.airDate,
                episodeNumber: hit.episodeNumber,
                seasonNumber: hit.seasonNumber,
                name: hit.episodeName ?? undefined,
            };
        } else {
            // Stale or missing — queue for live fetch
            missItems.push(item);
            // Return stale data optimistically while we refresh
            if (hit) {
                result[key] = {
                    airDate: hit.airDate,
                    episodeNumber: hit.episodeNumber,
                    seasonNumber: hit.seasonNumber,
                    name: hit.episodeName ?? undefined,
                };
            }
        }
    }

    // Fetch all misses concurrently
    if (missItems.length > 0) {
        const fetched = await Promise.allSettled(missItems.map((item) => fetchFromApis(item)));

        for (let i = 0; i < missItems.length; i++) {
            const item = missItems[i];
            const key = `${item.tmdbId}-${item.season}`;
            const outcome = fetched[i];

            if (outcome.status === "fulfilled" && outcome.value) {
                const ep = outcome.value;
                result[key] = ep;

                // Persist to cache (fire-and-forget — don't block the response)
                upsertCachedNextEpisode({
                    mediaId: item.tmdbId,
                    airDate: ep.airDate,
                    episodeNumber: ep.episodeNumber,
                    seasonNumber: ep.seasonNumber,
                    episodeName: ep.name ?? null,
                }).catch(() => {});
            } else if (outcome.status === "fulfilled") {
                // No next episode found — keep any stale result or set null
                if (!result[key]) result[key] = null;
            }
            // On rejection, leave stale result (already set above) or null
        }
    }

    return NextResponse.json(result, {
        headers: {
            "Cache-Control": "no-store",
        },
    });
}
