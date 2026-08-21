import { cache } from "react";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { kuryanaSearch, kuryanaGetDetails, kuryanaGetCast, parseMdlWatchers, KuryanaCastMember, KuryanaDrama } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";

export interface MdlCastMember {
    name: string;
    profileImage: string;
    slug: string;
    characterName: string;
    roleType: "Main Role" | "Support Role" | "Guest Role" | "Cameo";
}

export interface MdlCast {
    main: MdlCastMember[];
    support: MdlCastMember[];
    guest: MdlCastMember[];
    cameo: MdlCastMember[];
}

export interface MdlTag {
    id: number;
    name: string;
}

export interface MdlData {
    mdlSlug: string;
    mdlRating: number | null;
    mdlRanking: number | null;
    mdlPopularity: number | null;
    mdlWatchers: number | null;
    // MDL's broadcast range for this exact entry — per-season, unlike TMDB's
    // show-level first/last_air_date
    aired: string | null;
    tags: MdlTag[];
    genres: string[];
    cast: MdlCast | null;
    synopsis: string | null;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Strip everything that isn't a letter, digit, or non-latin character for fuzzy comparison
function normalizeTitle(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\u0080-\uffff]/g, "");
}

// Remove leading punctuation/symbols that break Kuryana search (e.g. "#Alive" → "Alive")
function sanitizeForSearch(s: string): string {
    return s.replace(/^[^a-zA-Z0-9\u0080-\uffff]+/, "").trim();
}

// Among dramas matching the target year (±1), pick the one whose title best matches
// one of the provided query strings. Falls back to the first year match.
function bestYearMatch(dramas: KuryanaDrama[], targetYear: number, queries: string[]): KuryanaDrama | null {
    const byYear = dramas.filter((d) => d.year === targetYear);
    const byYearFuzzy = dramas.filter((d) => Math.abs(d.year - targetYear) <= 1);
    const candidates = byYear.length ? byYear : byYearFuzzy;
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const normQueries = queries.map(normalizeTitle).filter(Boolean);
    for (const q of normQueries) {
        const exact = candidates.find((d) => normalizeTitle(d.title) === q);
        if (exact) return exact;
    }
    for (const q of normQueries) {
        const partial = candidates.find((d) => {
            const dt = normalizeTitle(d.title);
            return dt.includes(q) || q.includes(dt);
        });
        if (partial) return partial;
    }
    return candidates[0];
}

function normalizeCast(members: KuryanaCastMember[]): MdlCastMember[] {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

function cleanTagName(s: string): string {
    return s.replace(/\s*\(.*?tags\)\s*$/i, "").trim();
}

// Handles both old string[] cache entries and new {id, name}[] entries
function parseTags(raw: Prisma.JsonValue): MdlTag[] {
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).flatMap((t) => {
        if (typeof t === "string") {
            const name = cleanTagName(t);
            return name ? [{ id: 0, name }] : [];
        }
        if (t && typeof t === "object" && "id" in t && "name" in t) {
            const { id, name } = t as { id: number; name: string };
            const cleaned = cleanTagName(name);
            return cleaned ? [{ id, name: cleaned }] : [];
        }
        return [];
    });
}

function parseCastJson(raw: Prisma.JsonValue): MdlCast | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    return {
        main: (obj.main as MdlCastMember[]) ?? [],
        support: (obj.support as MdlCastMember[]) ?? [],
        guest: (obj.guest as MdlCastMember[]) ?? [],
        cameo: (obj.cameo as MdlCastMember[]) ?? [],
    };
}

// Returns cached MDL data for a specific season (2+) from MdlSeasonLink.
// Returns null if: season not linked, DB error, or row has no useful data yet
// (so the caller's ?? fallback reaches getMdlData for season-1 data).
export const getMdlSeasonData = cache(async function getMdlSeasonData(
    tmdbExternalId: string,
    season: number,
): Promise<MdlData | null> {
    if (season <= 1) return null;
    try {
        const row = await prisma.mdlSeasonLink.findUnique({
            where: { tmdbExternalId_season: { tmdbExternalId, season } },
        });
        if (!row) return null;

        const cast = parseCastJson(row.castJson);
        // Row exists but Kuryana data wasn't cached yet — fall back to getMdlData
        if (!row.mdlRating && !row.mdlRanking && !cast?.main.length && !cast?.support.length) {
            return null;
        }

        return {
            mdlSlug: row.mdlSlug,
            mdlRating: row.mdlRating,
            mdlRanking: row.mdlRanking,
            mdlPopularity: row.mdlPopularity,
            mdlWatchers: row.mdlWatchers,
            aired: row.aired,
            tags: parseTags(row.tags),
            genres: (row.genres as string[]) ?? [],
            cast,
            synopsis: row.synopsis ?? null,
        };
    } catch {
        return null;
    }
});

/**
 * Re-reads a fiche we already hold, after the response has gone out.
 *
 * Reuses the stored slug, which is the whole point: the miss path below has to
 * identify the drama from its title first — two searches before it can ask for
 * anything — while a row that already names its slug needs details and cast and
 * nothing else.
 *
 * Nothing here can make the page worse. The reader was served from cache before
 * this ran, and a failed scrape writes nothing, so the row it was served from
 * stays exactly as it was.
 */
function scheduleMdlRefresh(tmdbExternalId: string, mdlSlug: string) {
    try {
        after(async () => {
            try {
                const [details, castResult] = await Promise.all([
                    kuryanaGetDetails(mdlSlug),
                    kuryanaGetCast(mdlSlug),
                ]);
                const d = details?.data;
                if (!d) return; // keep what we have

                const cast: MdlCast | null = castResult?.data?.casts
                    ? {
                          main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                          support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                          guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
                          cameo: normalizeCast(castResult.data.casts["Cameo"] ?? []),
                      }
                    : null;

                const ranked = d.details?.ranked;
                const popularity = d.details?.popularity;
                const tags: MdlTag[] = (d.others?.tags ?? [])
                    .map((t) => ({ id: t.id, name: cleanTagName(t.name) }))
                    .filter((t) => t.name.length > 0);

                await prisma.cachedMdlData.update({
                    where: { tmdbExternalId },
                    data: {
                        mdlRating: d.rating != null ? parseFloat(String(d.rating)) || null : null,
                        mdlRanking: ranked ? parseInt(ranked.replace("#", "")) : null,
                        mdlPopularity: popularity ? parseInt(popularity.replace("#", "")) : null,
                        mdlWatchers: parseMdlWatchers(d.details?.watchers),
                        aired: d.details?.airs ?? d.details?.aired ?? null,
                        tags: tags as unknown as Prisma.InputJsonValue,
                        genres: d.others?.genres ?? [],
                        directors: d.others?.directors ?? [],
                        screenwriters: d.others?.screenwriter ?? [],
                        synopsis: d.synopsis || null,
                        // Only when the cast call actually answered: overwriting a
                        // good cast with null because that one request timed out is
                        // the failure this whole path exists to avoid.
                        ...(cast ? { castJson: cast as unknown as Prisma.InputJsonValue } : {}),
                        cachedAt: new Date(),
                    },
                });
            } catch (e) {
                console.error("[MDL] background refresh failed:", mdlSlug, e);
            }
        });
    } catch {
        // after() needs a request scope. Every caller is a server component, but
        // a future one might not be, and a missing top-up is not worth a crash.
    }
}

// cache() deduplicates calls with identical arguments within a single render pass,
// so MdlRatingBadge, MdlRankRow and MdlSection can all call this without extra DB/network hits.
export const getMdlData = cache(async function getMdlData(
    tmdbExternalId: string,
    title: string,
    year: string,
    nativeTitle?: string,
): Promise<MdlData | null> {
    const cached = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId },
    });

    if (cached?.mdlDisabled) return null;

    // A row we hold is always served, however old it is, and the top-up happens
    // behind the reader. Cast, synopsis and genres barely move once a drama has
    // aired, so blanking the whole MDL section for a re-scrape spent a visible
    // part of the page on a change that usually was not one — and if the scrape
    // failed, the reader got TMDB alone despite a perfectly good row on disk.
    //
    // The staleness test now decides when to re-read, not whether to show
    // anything. Same for a row missing a field: it is served as it stands and
    // filled in for next time, rather than held back until it is whole.
    if (cached) {
        const cast = parseCastJson(cached.castJson);
        const castIsEmpty = !cast || (cast.main.length === 0 && cast.support.length === 0 && cast.guest.length === 0);
        // Cast JSON written before cameo support carries no cameo key at all
        const castMissingCameo =
            !!cached.castJson &&
            typeof cached.castJson === "object" &&
            !Array.isArray(cached.castJson) &&
            !("cameo" in (cached.castJson as object));
        const cachedGenres = (cached.genres as string[] | null) ?? null;

        const incomplete = castIsEmpty || castMissingCameo || cached.synopsis === null || !cachedGenres?.length;
        const stale = cached.cachedAt <= new Date(Date.now() - CACHE_TTL_MS);
        if (incomplete || stale) scheduleMdlRefresh(tmdbExternalId, cached.mdlSlug);

        return {
            mdlSlug: cached.mdlSlug,
            mdlRating: cached.mdlRating,
            mdlRanking: cached.mdlRanking,
            mdlPopularity: cached.mdlPopularity,
            mdlWatchers: cached.mdlWatchers,
            aired: cached.aired,
            tags: parseTags(cached.tags),
            genres: cachedGenres ?? [],
            cast,
            synopsis: cached.synopsis,
        };
    }

    // Cache miss — search Kuryana with both native + English titles, merge results,
    // then pick the best year+title match from the full pool.
    try {
        const targetYear = parseInt(year);
        const queries = [nativeTitle, title].filter(Boolean) as string[];

        // Strip leading symbols before searching (e.g. "#Alive" → "Alive" so Kuryana finds it)
        const searchNative = nativeTitle ? sanitizeForSearch(nativeTitle) : null;
        const searchEnglish = sanitizeForSearch(title) || title;

        // Run searches in parallel when both titles are available
        const [nativeResults, englishResults] = await Promise.all([
            searchNative ? kuryanaSearch(searchNative) : Promise.resolve(null),
            kuryanaSearch(searchEnglish),
        ]);

        // Merge, deduplicating by slug (native results first so they score first)
        const seen = new Set<string>();
        const dramas: KuryanaDrama[] = [];
        for (const d of [
            ...(nativeResults?.results?.dramas ?? []),
            ...(englishResults?.results?.dramas ?? []),
        ]) {
            if (!seen.has(d.slug)) { seen.add(d.slug); dramas.push(d); }
        }

        const match = bestYearMatch(dramas, targetYear, queries);
        if (!match) return null;

        const [details, castResult] = await Promise.all([
            kuryanaGetDetails(match.slug),
            kuryanaGetCast(match.slug),
        ]);

        if (!details?.data) return null;

        const ranked = details.data.details?.ranked;
        const popularity = details.data.details?.popularity;

        const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
        const mdlWatchers = parseMdlWatchers(details.data.details?.watchers);
        const aired = details.data.details?.airs ?? details.data.details?.aired ?? null;
        const tags: MdlTag[] = (details.data.others?.tags ?? []).map((t) => ({ id: t.id, name: cleanTagName(t.name) })).filter((t) => t.name.length > 0);
        const genres = details.data.others?.genres ?? [];
        const directors = details.data.others?.directors ?? [];
        const screenwriters = details.data.others?.screenwriter ?? [];
        const synopsis = details.data.synopsis || null;

        const cast: MdlCast | null = castResult?.data?.casts
            ? {
                  main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                  support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                  guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
                  cameo: normalizeCast(castResult.data.casts["Cameo"] ?? []),
              }
            : null;

        await prisma.cachedMdlData.upsert({
            where: { tmdbExternalId },
            create: {
                tmdbExternalId,
                mdlSlug: match.slug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                mdlWatchers,
                aired,
                tags: tags as unknown as Prisma.InputJsonValue,
                genres,
                castJson: cast as unknown as Prisma.InputJsonValue,
                directors,
                screenwriters,
                synopsis,
            },
            update: {
                mdlSlug: match.slug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                mdlWatchers,
                aired,
                tags: tags as unknown as Prisma.InputJsonValue,
                genres,
                castJson: cast as unknown as Prisma.InputJsonValue,
                directors,
                screenwriters,
                synopsis,
                cachedAt: new Date(),
            },
        });

        return { mdlSlug: match.slug, mdlRating, mdlRanking, mdlPopularity, mdlWatchers, aired, tags, genres, cast, synopsis };
    } catch (e) {
        console.error("[MDL] Failed to fetch MDL data for:", title, e);
        return null;
    }
});
