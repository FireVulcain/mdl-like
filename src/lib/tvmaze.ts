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

export const tvmaze = {
    /**
     * Look up a show by IMDB ID and get next episode info
     */
    async getNextEpisodeByImdb(imdbId: string): Promise<{
        airDate: string;
        episodeNumber: number;
        seasonNumber: number;
        name: string;
    } | null> {
        // Lookup show by IMDB ID with embedded next episode
        const show = await fetchTVMaze<TVMazeShow>(`/lookup/shows`, {
            imdb: imdbId,
            embed: "nextepisode",
        });

        if (!show?._embedded?.nextepisode) {
            return null;
        }

        const nextEp = show._embedded.nextepisode;
        return {
            airDate: nextEp.airdate,
            episodeNumber: nextEp.number,
            seasonNumber: nextEp.season,
            name: nextEp.name,
        };
    },

    /**
     * Look up a show by TVDB ID and get next episode info
     */
    async getNextEpisodeByTvdb(tvdbId: number): Promise<{
        airDate: string;
        episodeNumber: number;
        seasonNumber: number;
        name: string;
    } | null> {
        const show = await fetchTVMaze<TVMazeShow>(`/lookup/shows`, {
            thetvdb: tvdbId.toString(),
            embed: "nextepisode",
        });

        if (!show?._embedded?.nextepisode) {
            return null;
        }

        const nextEp = show._embedded.nextepisode;
        return {
            airDate: nextEp.airdate,
            episodeNumber: nextEp.number,
            seasonNumber: nextEp.season,
            name: nextEp.name,
        };
    },

    /**
     * Search for a show by name and get next episode info
     */
    async getNextEpisodeByName(showName: string): Promise<{
        airDate: string;
        episodeNumber: number;
        seasonNumber: number;
        name: string;
    } | null> {
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

        const nextEp = show._embedded.nextepisode;
        return {
            airDate: nextEp.airdate,
            episodeNumber: nextEp.number,
            seasonNumber: nextEp.season,
            name: nextEp.name,
        };
    },
};
