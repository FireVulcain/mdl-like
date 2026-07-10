// Recommendation engine for ranking Plan to Watch items.
//
// Two stages, both pure functions (no DB access — the server action assembles inputs):
//   1. buildTasteProfile()  — turns the user's watched items into per-facet affinity maps
//   2. scoreCandidates()    — scores each Plan to Watch item against that profile with a
//                             weighted formula, returning a 0-100 match score + human reasons
//
// Every scoring component returns (points, reason) so recommendations stay explainable.

export type RecMediaItem = {
    id: string;
    externalId: string;
    source: string;
    season: number;
    title: string | null;
    poster: string | null;
    year: number | null;
    originCountry: string | null;
    mediaType: string;
    status: string;
    score: number | null;
    totalEp: number | null;
    tmdbRating: number | null;
    airingStatus: string | null;
    lastWatchedAt: Date | null;
    updatedAt: Date;
    // Enrichment from CachedMdlData (show-level)
    genres: string[];
    tags: string[];
    mainCast: { slug: string; name: string }[];
    supportCast: { slug: string; name: string }[];
    directors: string[];
    screenwriters: string[];
    mdlRating: number | null;
    mdlPopularity: number | null;
    // User signals
    isPodium: boolean;
    addedAt: Date | null; // when the user added this row to the watchlist
    isDismissed?: boolean; // "not interested" feedback on a recommendation
};

export type RecReason = { label: string; points: number };

export type RecResult = {
    id: string;
    score: number; // 0-100 match
    reasons: string[]; // top human-readable reasons, best first
};

// Component weights — must stay in sync with the scoring switch in scoreCandidates().
// Weights are renormalized over the components that have data for a given item, so a
// missing MDL cache doesn't tank an item's score.
export const REC_WEIGHTS = {
    genres: 0.2,
    tags: 0.18,
    cast: 0.13,
    crew: 0.06, // directors + screenwriters
    crowdQuality: 0.15,
    popularity: 0.06,
    country: 0.08,
    era: 0.05,
    lengthFit: 0.04,
    intent: 0.05,
} as const;

const PROFILE_RECENCY_HALF_LIFE_MONTHS = 18;
const INTENT_HALF_LIFE_MONTHS = 6;
const PODIUM_BOOST = 2.5;
const MDL_GLOBAL_MEAN = 7.4;

type FacetMap = Map<string, number>;

export type TasteProfile = {
    genres: FacetMap;
    tags: FacetMap;
    cast: FacetMap; // slug → weight
    castNames: Map<string, string>; // slug → display name
    crew: FacetMap; // director/screenwriter name → weight
    countries: FacetMap;
    decades: FacetMap;
    lengthBuckets: FacetMap; // from completed items only
    meanScore: number;
    watchedCount: number;
    // Genres+tags of the most recently completed shows, for anti-repetition
    recentlyCompletedFeatures: Set<string>[];
};

function monthsSince(date: Date, now: Date): number {
    return Math.max(0, (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
}

function decayWeight(date: Date | null, now: Date, halfLifeMonths: number): number {
    if (!date) return 0.6; // unknown date: mild discount rather than zero
    return Math.exp((-Math.LN2 * monthsSince(date, now)) / halfLifeMonths);
}

function decadeBucket(year: number | null): string | null {
    if (!year) return null;
    return `${Math.floor(year / 10) * 10}s`;
}

export function lengthBucket(mediaType: string, totalEp: number | null): string {
    if (mediaType === "MOVIE") return "movie";
    if (!totalEp) return "standard";
    if (totalEp <= 8) return "short";
    if (totalEp <= 16) return "standard";
    if (totalEp <= 32) return "long";
    return "verylong";
}

function addWeight(map: FacetMap, key: string, w: number) {
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + w);
}

// Scale a facet map so its max entry is 1 — keeps affinities comparable across
// users with very different watchlist sizes.
function maxNormalize(map: FacetMap): FacetMap {
    let max = 0;
    for (const v of map.values()) if (v > max) max = v;
    if (max <= 0) return map;
    const out: FacetMap = new Map();
    for (const [k, v] of map) out.set(k, v / max);
    return out;
}

export function buildTasteProfile(items: RecMediaItem[], now = new Date()): TasteProfile {
    // Dismissed recommendations count as a mild "not my thing" signal, weaker than
    // an explicit Drop (the user never tried the show, they just waved it away).
    const watched = items.filter(
        (i) => i.status === "Completed" || i.status === "Watching" || i.status === "Dropped" || i.isDismissed,
    );

    const scored = watched.filter((i) => i.score !== null);
    const meanScore = scored.length >= 3 ? scored.reduce((acc, i) => acc + i.score!, 0) / scored.length : 7.5;

    const genres: FacetMap = new Map();
    const tags: FacetMap = new Map();
    const cast: FacetMap = new Map();
    const castNames = new Map<string, string>();
    const crew: FacetMap = new Map();
    const countries: FacetMap = new Map();
    const decades: FacetMap = new Map();
    const lengthBuckets: FacetMap = new Map();

    for (const item of watched) {
        const base =
            item.status === "Completed" ? 1.0
            : item.status === "Watching" ? 0.7
            : item.status === "Dropped" ? -0.8
            : -0.3; // dismissed recommendation

        // Mean-centered enthusiasm: an 8 from someone who averages 8.5 is lukewarm.
        // Maps roughly to [0.3 … 2.0]; unscored items count as neutral.
        let quality = 1.0;
        if (item.score !== null) {
            quality = Math.min(2.0, Math.max(0.3, 1 + (item.score - meanScore) / 3));
        }

        const recency = decayWeight(item.lastWatchedAt ?? item.updatedAt, now, PROFILE_RECENCY_HALF_LIFE_MONTHS);
        // Recency should fade influence, not flip it — floor at 0.25 so old favorites still count.
        let w = base * quality * Math.max(0.25, recency);
        if (item.isPodium && w > 0) w *= PODIUM_BOOST;

        for (const g of item.genres) addWeight(genres, g, w);
        for (const t of item.tags) addWeight(tags, t, w);
        for (const m of item.mainCast) {
            addWeight(cast, m.slug, w);
            castNames.set(m.slug, m.name);
        }
        for (const s of item.supportCast) {
            addWeight(cast, s.slug, w * 0.4);
            if (!castNames.has(s.slug)) castNames.set(s.slug, s.name);
        }
        for (const d of item.directors) addWeight(crew, d, w);
        for (const sw of item.screenwriters) addWeight(crew, sw, w * 0.6);
        if (item.originCountry) addWeight(countries, item.originCountry, w);
        const dec = decadeBucket(item.year);
        if (dec) addWeight(decades, dec, w);
        if (item.status === "Completed") addWeight(lengthBuckets, lengthBucket(item.mediaType, item.totalEp), Math.abs(w));
    }

    // Anti-repetition: remember what the last 2 completed shows "felt like"
    const recentCompleted = watched
        .filter((i) => i.status === "Completed")
        .toSorted((a, b) => (b.lastWatchedAt ?? b.updatedAt).getTime() - (a.lastWatchedAt ?? a.updatedAt).getTime())
        .slice(0, 2);
    const recentlyCompletedFeatures = recentCompleted.map((i) => new Set([...i.genres, ...i.tags]));

    return {
        genres: maxNormalize(genres),
        tags: maxNormalize(tags),
        cast: maxNormalize(cast),
        castNames,
        crew: maxNormalize(crew),
        countries: maxNormalize(countries),
        decades: maxNormalize(decades),
        lengthBuckets: maxNormalize(lengthBuckets),
        meanScore,
        watchedCount: watched.filter((i) => i.status !== "Plan to Watch").length,
        recentlyCompletedFeatures,
    };
}

// Affinity of a candidate's feature list against a profile facet. The best-matching
// feature dominates (one beloved genre matters more than three mild ones), extra hits
// add on top, and negative weights (from dropped shows) actively subtract.
const AFFINITY_POSITION_WEIGHTS = [0.6, 0.25, 0.15];

function facetAffinity(features: string[], profile: FacetMap): { value: number; top: { key: string; w: number }[] } {
    if (features.length === 0 || profile.size === 0) return { value: 0, top: [] };
    const hits = features
        .map((f) => ({ key: f, w: profile.get(f) ?? 0 }))
        .filter((h) => h.w !== 0)
        .toSorted((a, b) => b.w - a.w);
    if (hits.length === 0) return { value: 0, top: [] };
    let value = 0;
    for (let i = 0; i < AFFINITY_POSITION_WEIGHTS.length && i < hits.length; i++) {
        value += hits[i].w * AFFINITY_POSITION_WEIGHTS[i];
    }
    return { value: Math.max(-1, Math.min(1, value)), top: hits.filter((h) => h.w > 0).slice(0, 3) };
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    return inter / (a.size + b.size - inter);
}

export function scoreCandidates(profile: TasteProfile, candidates: RecMediaItem[], now = new Date()): RecResult[] {
    const results: RecResult[] = [];

    for (const item of candidates) {
        // Each component: normalized 0-1 value + weight + optional reason.
        // Components without data are excluded and their weight renormalized away.
        const parts: { weight: number; value: number; reason?: string }[] = [];

        // — Genre affinity
        if (item.genres.length > 0 && profile.genres.size > 0) {
            const { value, top } = facetAffinity(item.genres, profile.genres);
            const names = top.slice(0, 2).map((t) => t.key);
            parts.push({
                weight: REC_WEIGHTS.genres,
                value,
                reason:
                    names.length && value > 0.35
                        ? `${names.join(" & ")} ${names.length > 1 ? "match" : "matches"} your top genres`
                        : undefined,
            });
        }

        // — Tag affinity
        if (item.tags.length > 0 && profile.tags.size > 0) {
            const { value, top } = facetAffinity(item.tags, profile.tags);
            const names = top.slice(0, 2).map((t) => t.key);
            parts.push({
                weight: REC_WEIGHTS.tags,
                value,
                reason: names.length && value > 0.3 ? `Themes you love: ${names.join(", ")}` : undefined,
            });
        }

        // — Cast affinity
        if ((item.mainCast.length > 0 || item.supportCast.length > 0) && profile.cast.size > 0) {
            const slugs = [...item.mainCast.map((c) => c.slug), ...item.supportCast.map((c) => c.slug)];
            const { value, top } = facetAffinity(slugs, profile.cast);
            const names = top.slice(0, 2).map((t) => profile.castNames.get(t.key) ?? t.key);
            parts.push({
                weight: REC_WEIGHTS.cast,
                value,
                reason: names.length && value > 0.25 ? `Stars ${names.join(" & ")} from shows you watched` : undefined,
            });
        }

        // — Crew affinity (directors weigh full, screenwriters 0.6 via the profile)
        if ((item.directors.length > 0 || item.screenwriters.length > 0) && profile.crew.size > 0) {
            const { value, top } = facetAffinity([...item.directors, ...item.screenwriters], profile.crew);
            const best = top[0]?.key;
            const role = best && item.directors.includes(best) ? "director" : "writer";
            parts.push({
                weight: REC_WEIGHTS.crew,
                value,
                reason: best && value > 0.25 ? `From ${role} ${best}, whose work you've watched` : undefined,
            });
        }

        // — Crowd quality: MDL rating shrunk toward the global mean by popularity.
        // An obscure 9.1 with rank #40000 shouldn't beat a proven 8.8.
        const rating = item.mdlRating ?? item.tmdbRating;
        if (rating) {
            const confidence = item.mdlPopularity ? 1 / (1 + item.mdlPopularity / 2000) : 0.5;
            const shrunk = MDL_GLOBAL_MEAN + (rating - MDL_GLOBAL_MEAN) * (0.5 + 0.5 * confidence);
            const value = Math.max(0, Math.min(1, (shrunk - 6.5) / 2.2));
            parts.push({
                weight: REC_WEIGHTS.crowdQuality,
                value,
                reason: rating >= 8.3 ? `Rated ${rating.toFixed(1)} on MDL` : undefined,
            });
        }

        // — Popularity / trending
        {
            let value = item.mdlPopularity ? 1 / (1 + item.mdlPopularity / 1500) : 0.3;
            let reason: string | undefined;
            if (item.airingStatus === "Returning Series") {
                value = Math.min(1, value + 0.3);
                reason = "Currently airing";
            } else if (item.mdlPopularity && item.mdlPopularity <= 250) {
                reason = "Very popular on MDL";
            }
            parts.push({ weight: REC_WEIGHTS.popularity, value, reason });
        }

        // — Country fit
        if (item.originCountry && profile.countries.size > 0) {
            const value = profile.countries.get(item.originCountry) ?? 0;
            parts.push({ weight: REC_WEIGHTS.country, value: Math.max(0, value) });
        }

        // — Era fit
        {
            const dec = decadeBucket(item.year);
            if (dec && profile.decades.size > 0) {
                parts.push({ weight: REC_WEIGHTS.era, value: Math.max(0, profile.decades.get(dec) ?? 0) });
            }
        }

        // — Length fit (what you actually finish)
        if (profile.lengthBuckets.size > 0) {
            const value = profile.lengthBuckets.get(lengthBucket(item.mediaType, item.totalEp)) ?? 0;
            parts.push({ weight: REC_WEIGHTS.lengthFit, value });
        }

        // — Watchlist intent: recent adds reflect current interest
        if (item.addedAt) {
            const value = decayWeight(item.addedAt, now, INTENT_HALF_LIFE_MONTHS);
            parts.push({
                weight: REC_WEIGHTS.intent,
                value,
                reason: monthsSince(item.addedAt, now) < 1 ? "You added this recently" : undefined,
            });
        }

        if (parts.length === 0) {
            results.push({ id: item.id, score: 0, reasons: [] });
            continue;
        }

        // Weighted average over available components, with a coverage floor: an item
        // missing most of its data (no MDL cache → no tags/cast/crowd) shouldn't get a
        // free pass by having its weights fully renormalized onto the few facets it has.
        const totalWeight = parts.reduce((acc, p) => acc + p.weight, 0);
        const effectiveWeight = Math.max(totalWeight, 0.65);
        let score = (parts.reduce((acc, p) => acc + p.weight * p.value, 0) / effectiveWeight) * 100;

        // Anti-repetition: small penalty if nearly identical to a just-completed show
        const itemFeatures = new Set([...item.genres, ...item.tags]);
        for (const recent of profile.recentlyCompletedFeatures) {
            if (jaccard(itemFeatures, recent) > 0.55) {
                score *= 0.88;
                break;
            }
        }

        const reasons = parts
            .filter((p) => p.reason && p.value > 0)
            .toSorted((a, b) => b.weight * b.value - a.weight * a.value)
            .slice(0, 3)
            .map((p) => p.reason!);

        results.push({ id: item.id, score: Math.round(Math.max(0, Math.min(100, score))), reasons });
    }

    return results.toSorted((a, b) => b.score - a.score);
}

// Maximal Marginal Relevance: pick top-N that score high AND differ from each other,
// so the picks aren't five near-identical shows.
export function pickTopDiverse(ranked: RecResult[], itemsById: Map<string, RecMediaItem>, n: number, lambda = 0.75): RecResult[] {
    const pool = ranked.slice(0, Math.max(n * 4, 12)).filter((r) => itemsById.has(r.id));
    const picked: RecResult[] = [];
    const pickedFeatures: Set<string>[] = [];

    while (picked.length < n && pool.length > 0) {
        let bestIdx = 0;
        let bestVal = -Infinity;
        for (let i = 0; i < pool.length; i++) {
            const item = itemsById.get(pool[i].id)!;
            const features = new Set([...item.genres, ...item.tags]);
            const maxSim = pickedFeatures.reduce((acc, f) => Math.max(acc, jaccard(features, f)), 0);
            const val = lambda * (pool[i].score / 100) - (1 - lambda) * maxSim;
            if (val > bestVal) {
                bestVal = val;
                bestIdx = i;
            }
        }
        const [chosen] = pool.splice(bestIdx, 1);
        const item = itemsById.get(chosen.id)!;
        picked.push(chosen);
        pickedFeatures.push(new Set([...item.genres, ...item.tags]));
    }
    return picked;
}
