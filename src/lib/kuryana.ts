const BASE_URL = process.env.KURYANA_URL ?? "https://mdl-scrapper-jade.vercel.app";

export interface KuryanaDrama {
    slug: string;
    thumb: string;
    mdl_id: string;
    title: string;
    ranking: string;
    type: string;
    year: number;
    series: string;
}

export interface KuryanaSearchResult {
    query: string;
    results: {
        dramas: KuryanaDrama[];
        people: unknown[];
    };
    scrape_date: string;
}

export interface KuryanaDetails {
    slug_query: string;
    data: {
        link: string;
        title: string;
        complete_title: string;
        sub_title: string; // e.g. "환혼 ‧ Drama ‧ 2022" — first segment is the native title
        year: string;
        rating: number | string | null;
        poster: string;
        synopsis: string;
        casts: { name: string; profile_image: string; slug: string }[];
        details: {
            country: string;
            type: string;
            episodes: string;
            aired: string;
            original_network: string;
            duration: string;
            score: string;
            ranked: string;
            popularity: string;
        };
        others: {
            genres: string[];
            directors: string[];
            screenwriter: string[];
            tags: string[];
        };
    };
    scrape_date: string;
}

export interface KuryanaCastMember {
    name: string;
    profile_image: string;
    slug: string;
    link: string;
    role: {
        name: string;
        type: "Main Role" | "Support Role" | "Guest Role";
    };
}

export interface KuryanaCastResult {
    slug_query: string;
    data: {
        link: string;
        title: string;
        poster: string;
        casts: {
            "Main Role"?: KuryanaCastMember[];
            "Support Role"?: KuryanaCastMember[];
            "Guest Role"?: KuryanaCastMember[];
            [key: string]: KuryanaCastMember[] | undefined;
        };
    };
    scrape_date: string;
}

async function kuryanaFetch<T>(path: string, timeoutMs = 8000): Promise<T | null> {
    // Use AbortController instead of AbortSignal.timeout — the latter creates a
    // DOMException with a read-only `message` property that Next.js's fetch cache
    // interceptor tries to overwrite, causing an unhandled TypeError crash.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            signal: controller.signal,
            next: { revalidate: 0 },
        });
        if (!res.ok) return null;
        return res.json() as Promise<T>;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

export async function kuryanaSearch(query: string): Promise<KuryanaSearchResult | null> {
    return kuryanaFetch<KuryanaSearchResult>(`/search/q/${encodeURIComponent(query)}`);
}

export async function kuryanaGetDetails(slug: string): Promise<KuryanaDetails | null> {
    return kuryanaFetch<KuryanaDetails>(`/id/${slug}`);
}

export async function kuryanaGetCast(slug: string): Promise<KuryanaCastResult | null> {
    return kuryanaFetch<KuryanaCastResult>(`/id/${slug}/cast`);
}

export interface KuryanaWorkItem {
    _slug: string; // e.g. "mdl-687393"
    year: number | string; // number or "TBA"
    title: {
        link: string;
        name: string;
    };
    rating: number;
    role: {
        name: string | null;
        type: string;
    };
    episodes?: number;
}

export interface KuryanaPersonResult {
    slug_query: string;
    data: {
        link: string;
        name: string;
        about: string;
        profile: string;
        works: {
            Drama?: KuryanaWorkItem[];
            Movie?: KuryanaWorkItem[];
            Special?: KuryanaWorkItem[];
            "TV Show"?: KuryanaWorkItem[];
            Producer?: KuryanaWorkItem[];
            [key: string]: KuryanaWorkItem[] | undefined;
        };
        details: {
            also_known_as?: string;
            nationality?: string;
            gender?: string;
            born?: string;
            age?: string;
        };
    };
    scrape_date: string;
}

export async function kuryanaGetPerson(slug: string): Promise<KuryanaPersonResult | null> {
    return kuryanaFetch<KuryanaPersonResult>(`/people/${slug}`);
}

export interface KuryanaReview {
    reviewer: {
        name: string;
        user_link: string;
        user_image: string | null;
        info: string | null; // e.g. "210 people found this review helpful"
    };
    review: string[] | null; // [title, ...body paragraphs]
    ratings: {
        overall: number;
        Story?: number;
        "Acting/Cast"?: number;
        Music?: number;
        "Rewatch Value"?: number;
        [key: string]: number | undefined;
    } | null;
}

export interface KuryanaReviewsResult {
    slug_query: string;
    data: {
        link: string;
        title: string;
        poster: string;
        reviews: KuryanaReview[];
    };
    scrape_date: string;
}

export async function kuryanaGetReviews(slug: string, page = 1): Promise<KuryanaReviewsResult | null> {
    return kuryanaFetch<KuryanaReviewsResult>(`/id/${slug}/reviews?page=${page}`);
}

export interface KuryanaEpisodeListItem {
    title: string;    // e.g. "The Prisoner of Beauty Episode 1"
    image: string;
    link: string;     // e.g. ".../episode/1"
    rating: string;   // e.g. "9.3/10 from 233 users"
    air_date: string;
}

export interface KuryanaEpisodesListResult {
    slug_query: string;
    data: {
        title: string;
        episodes: KuryanaEpisodeListItem[];
    };
    scrape_date: string;
}

export async function kuryanaGetEpisodesList(slug: string): Promise<KuryanaEpisodesListResult | null> {
    return kuryanaFetch<KuryanaEpisodesListResult>(`/id/${slug}/episodes/`);
}

export interface KuryanaEpisodeResult {
    slug_query: string;
    data: {
        link: string;
        title: string;
        episode_title: string;
        image: string;
        rating: number;
        synopsis: string;
        air_date: string;
    };
    scrape_date: string;
}

export async function kuryanaGetEpisode(slug: string, episodeNumber: number): Promise<KuryanaEpisodeResult | null> {
    return kuryanaFetch<KuryanaEpisodeResult>(`/id/${slug}/episode/${episodeNumber}`);
}
