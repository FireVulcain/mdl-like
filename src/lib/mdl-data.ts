import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { kuryanaSearch, kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember, KuryanaDrama } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";

export interface MdlCastMember {
    name: string;
    profileImage: string;
    slug: string;
    characterName: string;
    roleType: "Main Role" | "Support Role" | "Guest Role";
}

export interface MdlCast {
    main: MdlCastMember[];
    support: MdlCastMember[];
    guest: MdlCastMember[];
}

export interface MdlData {
    mdlSlug: string;
    mdlRating: number | null;
    mdlRanking: number | null;
    mdlPopularity: number | null;
    tags: string[];
    cast: MdlCast | null;
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

function parseCastJson(raw: Prisma.JsonValue): MdlCast | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const obj = raw as Record<string, unknown>;
    return {
        main: (obj.main as MdlCastMember[]) ?? [],
        support: (obj.support as MdlCastMember[]) ?? [],
        guest: (obj.guest as MdlCastMember[]) ?? [],
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
            tags: (row.tags as string[]) ?? [],
            cast,
        };
    } catch {
        return null;
    }
});

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

    const staleAt = new Date(Date.now() - CACHE_TTL_MS);
    if (cached && cached.cachedAt > staleAt) {
        const cast = parseCastJson(cached.castJson);
        const castIsEmpty = !cast || (cast.main.length === 0 && cast.support.length === 0 && cast.guest.length === 0);

        if (!castIsEmpty) {
            return {
                mdlSlug: cached.mdlSlug,
                mdlRating: cached.mdlRating,
                mdlRanking: cached.mdlRanking,
                mdlPopularity: cached.mdlPopularity,
                tags: (cached.tags as string[]) ?? [],
                cast,
            };
        }

        // Partial cache hit — metadata fresh but cast missing
        try {
            const castResult = await kuryanaGetCast(cached.mdlSlug);
            const newCast: MdlCast | null = castResult?.data?.casts
                ? {
                      main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                      support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                      guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
                  }
                : null;

            if (newCast) {
                await prisma.cachedMdlData.update({
                    where: { tmdbExternalId },
                    data: { castJson: newCast as unknown as Prisma.InputJsonValue },
                });
            }

            return {
                mdlSlug: cached.mdlSlug,
                mdlRating: cached.mdlRating,
                mdlRanking: cached.mdlRanking,
                mdlPopularity: cached.mdlPopularity,
                tags: (cached.tags as string[]) ?? [],
                cast: newCast,
            };
        } catch {
            return {
                mdlSlug: cached.mdlSlug,
                mdlRating: cached.mdlRating,
                mdlRanking: cached.mdlRanking,
                mdlPopularity: cached.mdlPopularity,
                tags: (cached.tags as string[]) ?? [],
                cast: null,
            };
        }
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
        const tags = details.data.others?.tags ?? [];

        const cast: MdlCast | null = castResult?.data?.casts
            ? {
                  main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                  support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                  guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
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
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
            },
            update: {
                mdlSlug: match.slug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
                cachedAt: new Date(),
            },
        });

        return { mdlSlug: match.slug, mdlRating, mdlRanking, mdlPopularity, tags, cast };
    } catch (e) {
        console.error("[MDL] Failed to fetch MDL data for:", title, e);
        return null;
    }
});
