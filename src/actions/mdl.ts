"use server";

import { prisma } from "@/lib/prisma";
import { kuryanaSearch, kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember } from "@/lib/kuryana";
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

export async function getMdlData(tmdbExternalId: string, title: string, year: string): Promise<MdlData | null> {
    // Check cache first
    const cached = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId },
    });

    const staleAt = new Date(Date.now() - CACHE_TTL_MS);
    if (cached && cached.cachedAt > staleAt) {
        const cast = parseCastJson(cached.castJson);
        const castIsEmpty = !cast || (cast.main.length === 0 && cast.support.length === 0 && cast.guest.length === 0);

        if (!castIsEmpty) {
            // Full cache hit — metadata + cast both valid
            return {
                mdlSlug: cached.mdlSlug,
                mdlRating: cached.mdlRating,
                mdlRanking: cached.mdlRanking,
                mdlPopularity: cached.mdlPopularity,
                tags: (cached.tags as string[]) ?? [],
                cast,
            };
        }

        // Partial cache hit — metadata is fresh but cast is missing/empty.
        // Re-fetch cast only using the already-known slug (no search needed).
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
            // Cast fetch failed — return metadata without cast
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

    // Cache miss — search Kuryana
    try {
        const searchResult = await kuryanaSearch(title);
        if (!searchResult?.results?.dramas?.length) return null;

        const targetYear = parseInt(year);
        const dramas = searchResult.results.dramas;

        // Prefer exact year match, fall back to ±1 year tolerance
        const match =
            dramas.find((d) => d.year === targetYear) ??
            dramas.find((d) => Math.abs(d.year - targetYear) <= 1);

        if (!match) return null;

        // Fetch details and cast in parallel
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
}
