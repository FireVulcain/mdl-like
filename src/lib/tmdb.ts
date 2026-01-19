const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

export const TMDB_CONFIG = {
    imageBaseUrl: TMDB_IMAGE_BASE_URL,
    originalImage: (path: string) => `${TMDB_IMAGE_BASE_URL}/original${path}`,
    w500Image: (path: string) => `${TMDB_IMAGE_BASE_URL}/w500${path}`,
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
};

export type TMDBSearchResult = {
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
    searchMulti: (query: string, page = 1) => fetchTMDB<TMDBSearchResult>("/search/multi", { query, page: page.toString() }),

    getDetails: (type: "movie" | "tv", id: string) => fetchTMDB<TMDBMedia>(`/${type}/${id}`),

    getTrending: (type: "all" | "movie" | "tv" = "all", timeWindow: "day" | "week" = "week") =>
        fetchTMDB<TMDBSearchResult>(`/trending/${type}/${timeWindow}`),

    discoverTV: (params: Record<string, string>) => fetchTMDB<TMDBSearchResult>("/discover/tv", params),

    getOnTheAir: (page = 1) => fetchTMDB<TMDBSearchResult>("/tv/on_the_air", { page: page.toString() }),

    getPersonDetails: (id: string) => fetchTMDB<TMDBPerson>(`/person/${id}`),

    getPersonCombinedCredits: (id: string) => fetchTMDB<TMDBPersonCredits>(`/person/${id}/combined_credits`),
};
