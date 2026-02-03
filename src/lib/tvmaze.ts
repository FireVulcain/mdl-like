const TVMAZE_BASE_URL = "https://api.tvmaze.com";

export type TVMazeShow = {
    id: number;
    name: string;
    externals: {
        tvrage: number | null;
        thetvdb: number | null;
        imdb: string | null;
    };
    _embedded?: {
        nextepisode?: TVMazeEpisode;
        seasons?: TVMazeSeason[];
        episodes?: TVMazeEpisode[];
    };
};

export type TVMazeEpisode = {
    id: number;
    name: string;
    season: number;
    number: number;
    airdate: string; // YYYY-MM-DD
    airstamp: string; // ISO 8601 datetime
    runtime: number;
    summary: string | null;
};

export type TVMazeSeason = {
    id: number;
    number: number;
    episodeOrder: number | null;
};

export type NextEpisodeResult = {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name: string;
    seasonEpisodeCount?: number; // Total episodes in this season (from TVmaze)
};

async function fetchTVMaze<T>(endpoint: string, params: Record<string, string> = {}): Promise<T | null> {
    const apiKey = process.env.TVMAZE_API_KEY;

    const queryParams = new URLSearchParams(params);
    if (apiKey) {
        queryParams.append("apikey", apiKey);
    }

    const queryString = queryParams.toString();
    const url = `${TVMAZE_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;

    try {
        const res = await fetch(url, {
            next: { revalidate: 3600 }, // Cache for 1 hour
        });

        if (!res.ok) {
            if (res.status === 404) {
                return null; // Show not found
            }
            console.error(`TVMaze API Error: ${res.status} ${res.statusText}`);
            return null;
        }

        return res.json();
    } catch (error) {
        console.error("TVMaze fetch error:", error);
        return null;
    }
}

async function getSeasonEpisodeCount(showId: number, seasonNumber: number, seasons: TVMazeSeason[] | undefined): Promise<number | undefined> {
    // First try to get from season's episodeOrder
    if (seasons) {
        const season = seasons.find((s) => s.number === seasonNumber);
        if (season?.episodeOrder) {
            return season.episodeOrder;
        }
    }

    // If episodeOrder is null (common for ongoing seasons), fetch actual episodes and count
    try {
        const episodes = await fetchTVMaze<TVMazeEpisode[]>(`/shows/${showId}/episodes`);
        if (episodes) {
            const seasonEpisodes = episodes.filter((ep) => ep.season === seasonNumber);
            if (seasonEpisodes.length > 0) {
                // Return the highest episode number in this season
                return Math.max(...seasonEpisodes.map((ep) => ep.number));
            }
        }
    } catch (error) {
        console.error("Failed to fetch episodes for count:", error);
    }

    return undefined;
}

async function extractNextEpisodeData(show: TVMazeShow | null, showId: number): Promise<NextEpisodeResult | null> {
    if (!show?._embedded?.nextepisode) {
        return null;
    }

    const nextEp = show._embedded.nextepisode;
    const seasons = show._embedded?.seasons;

    // Get the episode count for this season
    const seasonEpisodeCount = await getSeasonEpisodeCount(showId, nextEp.season, seasons);

    return {
        airDate: nextEp.airdate,
        episodeNumber: nextEp.number,
        seasonNumber: nextEp.season,
        name: nextEp.name,
        seasonEpisodeCount,
    };
}

export const tvmaze = {
    /**
     * Look up a show by IMDB ID and get next episode info
     */
    async getNextEpisodeByImdb(imdbId: string): Promise<NextEpisodeResult | null> {
        // Lookup show by IMDB ID with embedded next episode
        const show = await fetchTVMaze<TVMazeShow>(`/lookup/shows`, {
            imdb: imdbId,
            embed: "nextepisode",
        });

        if (!show?._embedded?.nextepisode) {
            return null;
        }

        // Fetch seasons separately to get episode counts
        const seasons = await fetchTVMaze<TVMazeSeason[]>(`/shows/${show.id}/seasons`);
        if (seasons) {
            show._embedded.seasons = seasons;
        }

        return extractNextEpisodeData(show, show.id);
    },

    /**
     * Look up a show by TVDB ID and get next episode info
     */
    async getNextEpisodeByTvdb(tvdbId: number): Promise<NextEpisodeResult | null> {
        const show = await fetchTVMaze<TVMazeShow>(`/lookup/shows`, {
            thetvdb: tvdbId.toString(),
            embed: "nextepisode",
        });

        if (!show?._embedded?.nextepisode) {
            return null;
        }

        // Fetch seasons separately to get episode counts
        const seasons = await fetchTVMaze<TVMazeSeason[]>(`/shows/${show.id}/seasons`);
        if (seasons) {
            show._embedded.seasons = seasons;
        }

        return extractNextEpisodeData(show, show.id);
    },

    /**
     * Search for a show by name and get next episode info
     */
    async getNextEpisodeByName(showName: string): Promise<NextEpisodeResult | null> {
        // Search for show
        const searchResults = await fetchTVMaze<{ show: TVMazeShow }[]>(`/search/shows`, {
            q: showName,
        });

        if (!searchResults || searchResults.length === 0) {
            return null;
        }

        // Get the first result's ID and fetch with embedded next episode
        const showId = searchResults[0].show.id;
        const show = await fetchTVMaze<TVMazeShow>(`/shows/${showId}`, {
            embed: "nextepisode",
        });

        if (!show?._embedded?.nextepisode) {
            return null;
        }

        // Fetch seasons separately to get episode counts
        const seasons = await fetchTVMaze<TVMazeSeason[]>(`/shows/${showId}/seasons`);
        if (seasons) {
            show._embedded.seasons = seasons;
        }

        return extractNextEpisodeData(show, showId);
    },
};
