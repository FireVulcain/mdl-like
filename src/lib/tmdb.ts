const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const TMDB_CONFIG = {
    imageBaseUrl: TMDB_IMAGE_BASE_URL,
    originalImage: (path: string) => `${TMDB_IMAGE_BASE_URL}/original${path}`,
    // Poster sizes (for portrait images)
    w342Image: (path: string) => `${TMDB_IMAGE_BASE_URL}/w342${path}`,
    w500Image: (path: string) => `${TMDB_IMAGE_BASE_URL}/w500${path}`,
    w780Image: (path: string) => `${TMDB_IMAGE_BASE_URL}/w780${path}`,
    // Backdrop sizes (for landscape images) - use these instead of original for better performance
    w780Backdrop: (path: string) => `${TMDB_IMAGE_BASE_URL}/w780${path}`,
    w1280Backdrop: (path: string) => `${TMDB_IMAGE_BASE_URL}/w1280${path}`,
};


export type TMDBMedia = {
    id: number;
    title?: string;
    name?: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date?: string;
    first_air_date?: string;
    origin_country?: string[];
    original_language?: string;
    popularity?: number;
    vote_average: number;
    media_type?: "movie" | "tv";
    number_of_episodes?: number;
    status?: string;
    seasons?: {
        air_date: string;
        episode_count: number;
        id: number;
        name: string;
        overview: string;
        poster_path: string;
        season_number: number;
        vote_average: number;
    }[];
    credits?: {
        cast: {
            id: number;
            name: string;
            character: string;
            profile_path: string | null;
        }[];
    };
    recommendations?: {
        results: TMDBMedia[];
    };
    images?: {
        backdrops: { file_path: string }[];
        posters: { file_path: string }[];
    };
    // Details for info panel
    runtime?: number; // For movies
    episode_run_time?: number[]; // For TV
    last_air_date?: string;
    networks?: { name: string }[];
    genres?: { name: string }[];
    content_ratings?: {
        results: { iso_3166_1: string; rating: string }[];
    };
    release_dates?: {
        results: { iso_3166_1: string; release_dates: { certification: string }[] }[];
    };
    videos?: {
        results: {
            id: string;
            key: string; // YouTube video ID
            name: string;
            site: string; // "YouTube", "Vimeo", etc.
            type: string; // "Trailer", "Teaser", "Clip", "Featurette", etc.
            official: boolean;
        }[];
    };
    next_episode_to_air?: {
        id: number;
        name: string;
        overview: string;
        air_date: string;
        episode_number: number;
        season_number: number;
        runtime: number | null;
    } | null;
    number_of_seasons?: number;
};

// Result type for /search/multi endpoint (includes persons)
export type TMDBMultiSearchResult = {
    page: number;
    results: (TMDBMedia | TMDBPersonSearchResult)[];
    total_pages: number;
    total_results: number;
};

// Result type for media-only endpoints (discover, trending, on_the_air)
export type TMDBMediaResult = {
    page: number;
    results: TMDBMedia[];
    total_pages: number;
    total_results: number;
};

export type TMDBPerson = {
    id: number;
    name: string;
    biography: string;
    birthday: string | null;
    deathday: string | null;
    place_of_birth: string | null;
    profile_path: string | null;
    gender: number; // 0 = Not set, 1 = Female, 2 = Male, 3 = Non-binary
    known_for_department: string;
    popularity: number;
    also_known_as: string[];
    homepage: string | null;
};

// Person result from /search/multi endpoint
export type TMDBPersonSearchResult = {
    id: number;
    name: string;
    profile_path: string | null;
    known_for_department: string;
    popularity: number;
    gender: number;
    media_type: "person";
    known_for: {
        id: number;
        title?: string;
        name?: string;
        media_type: "movie" | "tv";
        poster_path: string | null;
    }[];
};

export type TMDBPersonCredits = {
    id: number;
    cast: {
        id: number;
        title?: string;
        name?: string;
        character: string;
        poster_path: string | null;
        backdrop_path: string | null;
        release_date?: string;
        first_air_date?: string;
        vote_average: number;
        media_type: "movie" | "tv";
        episode_count?: number;
        origin_country?: string[];
        genre_ids?: number[];
    }[];
};

export type TMDBExternalIds = {
    id: number;
    imdb_id: string | null;
    tvdb_id: number | null;
    wikidata_id: string | null;
    facebook_id: string | null;
    instagram_id: string | null;
    twitter_id: string | null;
};

export async function fetchTMDB<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) {
        throw new Error("TMDB_API_KEY is not defined");
    }

    const queryParams = new URLSearchParams(params);
    queryParams.append("api_key", apiKey);
    queryParams.append("language", "en-US");

    const res = await fetch(`${TMDB_BASE_URL}${endpoint}?${queryParams.toString()}`, {
        next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!res.ok) {
        throw new Error(`TMDB API Error: ${res.status} ${res.statusText}`);
    }

    return res.json();
}

export const tmdb = {
    searchMulti: (query: string, page = 1) => fetchTMDB<TMDBMultiSearchResult>("/search/multi", { query, page: page.toString() }),

    getDetails: (type: "movie" | "tv", id: string) => fetchTMDB<TMDBMedia>(`/${type}/${id}`),

    getTrending: (type: "all" | "movie" | "tv" = "all", timeWindow: "day" | "week" = "week") =>
        fetchTMDB<TMDBMediaResult>(`/trending/${type}/${timeWindow}`),

    discoverTV: (params: Record<string, string>) => fetchTMDB<TMDBMediaResult>("/discover/tv", params),

    getOnTheAir: (page = 1) => fetchTMDB<TMDBMediaResult>("/tv/on_the_air", { page: page.toString() }),

    getPersonDetails: (id: string) => fetchTMDB<TMDBPerson>(`/person/${id}`),

    getPersonCombinedCredits: (id: string) => fetchTMDB<TMDBPersonCredits>(`/person/${id}/combined_credits`),

    getExternalIds: (type: "movie" | "tv", id: string) => fetchTMDB<TMDBExternalIds>(`/${type}/${id}/external_ids`),
};
