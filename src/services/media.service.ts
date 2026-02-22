import { tmdb, TMDBMedia, TMDBPersonSearchResult, TMDB_CONFIG, fetchTMDB } from "@/lib/tmdb";
import { tvmaze } from "@/lib/tvmaze";

export type UnifiedMedia = {
    id: string; // Unified: "tmdb-123" or "mdl-456"
    externalId: string;
    source: "TMDB" | "MDL";
    type: "MOVIE" | "TV";
    title: string;
    nativeTitle?: string;
    poster: string | null;
    backdrop: string | null;
    year: string;
    originCountry: string; // 'US', 'KR', 'JP', etc.
    synopsis: string;
    rating: number;
    popularity?: number;
    status?: string; // For TV shows: "Returning Series", "Ended", etc.
    totalEp?: number;
    seasons?: {
        seasonNumber: number;
        episodeCount: number;
        name: string;
        poster: string | null;
        airDate: string | null;
    }[];
    cast?: {
        id: number;
        name: string;
        character: string;
        profile: string | null;
    }[];
    images?: {
        backdrops: string[];
        posters: string[];
    };
    recommendations?: UnifiedMedia[];
    // Extra Details
    duration?: string;
    aired?: string;
    network?: string;
    genres?: string[];
    contentRating?: string;
    trailer?: {
        key: string; // YouTube video ID
        name: string;
    };
    nextEpisode?: {
        airDate: string; // ISO date string
        episodeNumber: number;
        seasonNumber: number;
        name: string;
        seasonEpisodeCount?: number; // From TVmaze - more accurate than TMDB
    } | null;
    totalSeasons?: number;
    firstAirDate?: string | null; // Raw first air date (YYYY-MM-DD)
};

export type UnifiedPerson = {
    id: string; // "person-123"
    externalId: string;
    name: string;
    profileImage: string | null;
    knownForDepartment: string;
    popularity: number;
    knownFor: {
        id: number;
        title: string;
        mediaType: "movie" | "tv";
        poster: string | null;
    }[];
};

export type SearchResults = {
    media: UnifiedMedia[];
    people: UnifiedPerson[];
};

export const mediaService = {
    async search(query: string): Promise<SearchResults> {
        // Primary Source: TMDB
        const tmdbResults = await tmdb.searchMulti(query);

        // Transform TMDB media results
        const mediaResults: UnifiedMedia[] = tmdbResults.results
            .filter((item): item is TMDBMedia & { media_type: "movie" | "tv" } => item.media_type === "movie" || item.media_type === "tv")
            .map((item) => ({
                id: `tmdb-${item.id}`,
                externalId: item.id.toString(),
                source: "TMDB" as "TMDB" | "MDL",
                type: (item.media_type === "movie" ? "MOVIE" : "TV") as "MOVIE" | "TV",
                title: item.title || item.name || "Unknown",
                poster: item.poster_path ? TMDB_CONFIG.w500Image(item.poster_path) : null,
                backdrop: item.backdrop_path ? TMDB_CONFIG.w1280Backdrop(item.backdrop_path) : null,
                year: (item.release_date || item.first_air_date || "").split("-")[0],
                originCountry: item.origin_country?.[0] || "US",
                synopsis: item.overview,
                rating: item.vote_average,
                popularity: item.popularity,
            }))
            .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

        // Transform TMDB person results
        const peopleResults: UnifiedPerson[] = tmdbResults.results
            .filter((item): item is TMDBPersonSearchResult => item.media_type === "person")
            .map((item) => ({
                id: `person-${item.id}`,
                externalId: item.id.toString(),
                name: item.name,
                profileImage: item.profile_path ? TMDB_CONFIG.w500Image(item.profile_path) : null,
                knownForDepartment: item.known_for_department,
                popularity: item.popularity,
                knownFor: item.known_for.slice(0, 3).map((work) => ({
                    id: work.id,
                    title: work.title || work.name || "Unknown",
                    mediaType: work.media_type,
                    poster: work.poster_path ? TMDB_CONFIG.w342Image(work.poster_path) : null,
                })),
            }))
            .sort((a, b) => b.popularity - a.popularity);

        // TODO: Implement MDL search and deduplication logic here

        return { media: mediaResults, people: peopleResults };
    },

    async getDetails(id: string): Promise<UnifiedMedia | null> {
        const [source, externalId] = id.split("-");

        if (source === "tmdb") {
            try {
                let details: TMDBMedia;
                let type: "tv" | "movie" = "tv";

                try {
                    // append_to_response for credits, recommendations, images, content_ratings, videos
                    details = await fetchTMDB<TMDBMedia>(`/tv/${externalId}`, {
                        append_to_response: "credits,recommendations,images,content_ratings,videos",
                        include_image_language: "en,null",
                    });
                } catch (e) {
                    details = await fetchTMDB<TMDBMedia>(`/movie/${externalId}`, {
                        append_to_response: "credits,recommendations,images,release_dates,videos",
                        include_image_language: "en,null",
                    });
                    type = "movie";
                }

                // Helper for content rating
                const getRating = () => {
                    if (type === "movie") {
                        const us = details.release_dates?.results.find((r) => r.iso_3166_1 === "US");
                        return us?.release_dates[0]?.certification || "";
                    } else {
                        const rating = details.content_ratings?.results.find((r) => r.iso_3166_1 === "US" || r.iso_3166_1 === "KR");
                        return rating?.rating || "";
                    }
                };

                // Helper for duration
                const getDuration = () => {
                    const runtime = type === "movie" ? details.runtime : details.episode_run_time?.[0];
                    if (!runtime) return undefined;
                    const h = Math.floor(runtime / 60);
                    const m = runtime % 60;
                    return h > 0 ? `${h} hr. ${m} min.` : `${m} min.`;
                };

                // Helper for trailer (prioritize official YouTube trailers)
                const getTrailer = () => {
                    const videos = details.videos?.results || [];
                    // Find official trailer first, then any trailer, then teaser
                    const trailer =
                        videos.find((v) => v.site === "YouTube" && v.type === "Trailer" && v.official) ||
                        videos.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
                        videos.find((v) => v.site === "YouTube" && v.type === "Teaser");
                    return trailer ? { key: trailer.key, name: trailer.name } : undefined;
                };

                // Fetch next episode from TVmaze (for TV shows only)
                let nextEpisodeData: {
                    airDate: string;
                    episodeNumber: number;
                    seasonNumber: number;
                    name: string;
                    seasonEpisodeCount?: number;
                } | null = null;
                if (type === "tv") {
                    try {
                        // Get external IDs from TMDB
                        const externalIds = await tmdb.getExternalIds("tv", externalId);

                        // Try TVmaze lookup by IMDB ID first, then TVDB ID, then show name
                        if (externalIds?.imdb_id) {
                            nextEpisodeData = await tvmaze.getNextEpisodeByImdb(externalIds.imdb_id);
                        }
                        if (!nextEpisodeData && externalIds?.tvdb_id) {
                            nextEpisodeData = await tvmaze.getNextEpisodeByTvdb(externalIds.tvdb_id);
                        }
                        if (!nextEpisodeData && details.name) {
                            nextEpisodeData = await tvmaze.getNextEpisodeByName(details.name);
                        }
                    } catch (error) {
                        console.error("Error fetching next episode from TVmaze:", error);
                    }

                    // Fall back to TMDB if TVmaze doesn't have the data
                    if (!nextEpisodeData && details.next_episode_to_air) {
                        nextEpisodeData = {
                            airDate: details.next_episode_to_air.air_date,
                            episodeNumber: details.next_episode_to_air.episode_number,
                            seasonNumber: details.next_episode_to_air.season_number,
                            name: details.next_episode_to_air.name,
                        };
                    }
                }

                return {
                    id: `tmdb-${details.id}`,
                    externalId: details.id.toString(),
                    source: "TMDB" as "TMDB" | "MDL",
                    type: (type === "movie" ? "MOVIE" : "TV") as "MOVIE" | "TV",
                    title: details.title || details.name || "Unknown",
                    nativeTitle: details.original_title || details.original_name || undefined,
                    poster: details.poster_path ? TMDB_CONFIG.w500Image(details.poster_path) : null,
                    backdrop: details.backdrop_path ? TMDB_CONFIG.w1280Backdrop(details.backdrop_path) : null,
                    year: (details.release_date || details.first_air_date || "").split("-")[0],
                    originCountry: details.origin_country?.[0] || "US",
                    synopsis: details.overview,
                    rating: details.vote_average,
                    totalEp: type === "movie" ? 1 : details.number_of_episodes,
                    status: details.status,

                    // New Fields
                    duration: getDuration(),
                    aired:
                        type === "movie"
                            ? details.release_date
                            : `${details.first_air_date || "?"} - ${details.status === "Ended" ? details.last_air_date || "?" : "Present"}`,
                    network: details.networks?.[0]?.name,
                    genres: details.genres?.map((g) => g.name) || [],
                    contentRating: getRating(),
                    trailer: getTrailer(),

                    seasons: details.seasons
                        ?.map((s) => ({
                            seasonNumber: s.season_number,
                            episodeCount: s.episode_count,
                            name: s.name,
                            poster: s.poster_path ? TMDB_CONFIG.w500Image(s.poster_path) : null,
                            airDate: s.air_date || null,
                        }))
                        .filter((s) => s.seasonNumber > 0), // Filter out "Specials" (Season 0) usually

                    // Next Episode (from TVmaze, with TMDB fallback)
                    nextEpisode: nextEpisodeData,
                    totalSeasons: details.number_of_seasons,
                    firstAirDate: details.first_air_date || null,

                    cast: details.credits?.cast?.map((actor) => ({
                        id: actor.id,
                        name: actor.name,
                        character: actor.character,
                        profile: actor.profile_path ? TMDB_CONFIG.w500Image(actor.profile_path) : null,
                    })),

                    // Map Images
                    images: {
                        backdrops: details.images?.backdrops?.map((b) => TMDB_CONFIG.w1280Backdrop(b.file_path)) || [],
                        posters: details.images?.posters?.map((p) => TMDB_CONFIG.w500Image(p.file_path)) || [],
                    },

                    // Map Recommendations
                    recommendations: details.recommendations?.results?.slice(0, 6).map((item) => ({
                        id: `tmdb-${item.id}`,
                        externalId: item.id.toString(),
                        source: "TMDB" as "TMDB" | "MDL",
                        type: (item.media_type === "movie" || (!item.media_type && type === "movie") ? "MOVIE" : "TV") as "MOVIE" | "TV",
                        title: item.title || item.name || "Unknown",
                        poster: item.poster_path ? TMDB_CONFIG.w500Image(item.poster_path) : null,
                        backdrop: item.backdrop_path ? TMDB_CONFIG.w1280Backdrop(item.backdrop_path) : null,
                        year: (item.release_date || item.first_air_date || "").split("-")[0],
                        originCountry: item.origin_country?.[0] || "US",
                        synopsis: item.overview,
                        rating: item.vote_average,
                    })) as UnifiedMedia[],
                };
            } catch (error) {
                console.error("Error fetching details", error);
                return null;
            }
        }

        return null;
    },

    async getTrending(): Promise<UnifiedMedia[]> {
        try {
            const tmdbResults = await tmdb.getTrending("all", "week");

            return tmdbResults.results
                .filter((item) => item.media_type === "movie" || item.media_type === "tv")
                .map((item) => ({
                    id: `tmdb-${item.id}`,
                    externalId: item.id.toString(),
                    source: "TMDB" as "TMDB" | "MDL",
                    type: (item.media_type === "movie" ? "MOVIE" : "TV") as "MOVIE" | "TV",
                    title: item.title || item.name || "Unknown",
                    poster: item.poster_path ? TMDB_CONFIG.w500Image(item.poster_path) : null,
                    backdrop: item.backdrop_path ? TMDB_CONFIG.w1280Backdrop(item.backdrop_path) : null,
                    year: (item.release_date || item.first_air_date || "").split("-")[0],
                    originCountry: item.origin_country?.[0] || "US",
                    synopsis: item.overview,
                    rating: item.vote_average,
                })) as UnifiedMedia[];
        } catch (error) {
            console.warn("Failed to fetch trending media (likely no API key), using mock data");
            return [
                {
                    id: "mock-1",
                    externalId: "1",
                    source: "TMDB" as const,
                    type: "TV" as const,
                    title: "Mock Drama (No API Key)",
                    poster: null,
                    backdrop: null,
                    year: "2024",
                    originCountry: "KR",
                    synopsis: "This is a mock item displayed because the TMDB_API_KEY is missing.",
                    rating: 8.5,
                },
            ] as UnifiedMedia[];
        }
    },

    async browseDramas({
        category = "popular",
        country = "KR",
        sort = "popularity.desc",
        genres = "18",
        year,
        page = 1,
    }: {
        category?: string;
        country?: string;
        sort?: string;
        genres?: string; // comma-separated TMDB genre IDs
        year?: string;
        page?: number;
    }): Promise<{ items: UnifiedMedia[]; totalPages: number; totalResults: number }> {
        try {
            const today = new Date().toISOString().split("T")[0];
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
            const twelveMonthsLater = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

            const originCountry = country === "all" ? "KR|CN" : country;

            const params: Record<string, string> = {
                with_origin_country: originCountry,
                sort_by: sort,
                page: page.toString(),
            };

            params["first_air_date.gte"] = "2010-01-01";

            if (genres) params.with_genres = genres;

            // Require a minimum vote count when sorting by rating to avoid
            // unknown shows with 1-2 votes at 10/10 dominating the results
            if (sort === "vote_average.desc") params["vote_count.gte"] = "100";

            if (category === "airing") {
                params["air_date.gte"] = today;
                params["first_air_date.lte"] = today;
            } else if (category === "upcoming") {
                params["first_air_date.gte"] = tomorrow;
                params["first_air_date.lte"] = twelveMonthsLater;
            } else if (year) {
                params["first_air_date.gte"] = `${year}-01-01`;
                params["first_air_date.lte"] = `${year}-12-31`;
            }

            const result = await tmdb.discoverTV(params);

            const items: UnifiedMedia[] = result.results.map((item) => ({
                id: `tmdb-${item.id}`,
                externalId: item.id.toString(),
                source: "TMDB",
                type: "TV",
                title: item.name || "Unknown",
                poster: item.poster_path ? TMDB_CONFIG.w500Image(item.poster_path) : null,
                backdrop: item.backdrop_path ? TMDB_CONFIG.w1280Backdrop(item.backdrop_path) : null,
                year: (item.first_air_date || "").split("-")[0],
                originCountry: item.origin_country?.[0] ?? (country === "all" ? "" : country),
                synopsis: item.overview,
                rating: item.vote_average,
                popularity: item.popularity,
                firstAirDate: item.first_air_date || null,
            }));

            return {
                items,
                totalPages: Math.min(result.total_pages, 100),
                totalResults: result.total_results,
            };
        } catch (error) {
            console.error("Error browsing dramas:", error);
            return { items: [], totalPages: 0, totalResults: 0 };
        }
    },

    async getKDramas(): Promise<{ trending: UnifiedMedia[]; airing: UnifiedMedia[]; upcoming: UnifiedMedia[] }> {
        try {
            const today = new Date().toISOString().split("T")[0];
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
            const sixMonthsLater = new Date(Date.now() + 180 * 86400000).toISOString().split("T")[0];

            // Parallel fetch: all three API calls are independent
            const [popularRes, airingRes, upcomingRes] = await Promise.all([
                // Trending K-Dramas (using popularity as proxy for trending within category)
                tmdb.discoverTV({
                    with_origin_country: "KR",
                    with_genres: "18", // Drama
                    sort_by: "popularity.desc",
                }),
                // Currently Airing K-Dramas
                tmdb.discoverTV({
                    with_origin_country: "KR",
                    with_genres: "18",
                    "air_date.gte": today,
                    "first_air_date.lte": today, // Ensure it has actually started
                    sort_by: "popularity.desc",
                }),
                // Upcoming K-Dramas (premiering in the next 6 months)
                tmdb.discoverTV({
                    with_origin_country: "KR",
                    with_genres: "18",
                    "first_air_date.gte": tomorrow,
                    "first_air_date.lte": sixMonthsLater,
                    sort_by: "popularity.desc",
                }),
            ]);

            const transform = (item: TMDBMedia, posterOverride?: string | null): UnifiedMedia => ({
                id: `tmdb-${item.id}`,
                externalId: item.id.toString(),
                source: "TMDB",
                type: "TV",
                title: item.name || "Unknown",
                poster: item.poster_path ? TMDB_CONFIG.w500Image(item.poster_path) : (posterOverride ?? null),
                backdrop: item.backdrop_path ? TMDB_CONFIG.w1280Backdrop(item.backdrop_path) : null,
                year: (item.first_air_date || "").split("-")[0],
                originCountry: "KR",
                synopsis: item.overview,
                rating: item.vote_average,
                popularity: item.popularity,
                firstAirDate: item.first_air_date || null,
            });

            // For upcoming shows missing a TMDB poster, fall back to TVmaze
            const upcomingPosterOverrides = new Map<number, string>();
            const missingPosters = upcomingRes.results.filter((item) => !item.poster_path);
            if (missingPosters.length > 0) {
                await Promise.all(
                    missingPosters.map(async (item) => {
                        const poster = await tvmaze.getPosterByName(item.name || "");
                        if (poster) upcomingPosterOverrides.set(item.id, poster);
                    }),
                );
            }

            return {
                trending: popularRes.results.map((item) => transform(item)),
                airing: airingRes.results.map((item) => transform(item)),
                upcoming: upcomingRes.results.map((item) => {
                    const tvmazePoster = upcomingPosterOverrides.get(item.id);
                    const backdropFallback = item.backdrop_path ? TMDB_CONFIG.originalImage(item.backdrop_path) : null;
                    return transform(item, tvmazePoster ?? backdropFallback);
                }),
            };
        } catch (error) {
            console.error("Error fetching K-Dramas", error);
            return { trending: [], airing: [], upcoming: [] };
        }
    },
};
