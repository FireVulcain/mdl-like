import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCachedNextEpisodes, upsertCachedNextEpisode } from "@/lib/next-episode-cache";
import { fetchNextEpisodeFromApis } from "@/lib/next-episode-fetch";

export const maxDuration = 30;

type RequestItem = {
    tmdbId: string;
    season: number;
    title: string;
};

type NextEpisodeResult = {
    airDate: string;
    airDateTime?: string | null;
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
    seasonEpisodeCount?: number;
} | null;

// MDL slugs for the requested items: season links take priority; the show-level
// slug only applies to season 1 (using it for S2+ would return S1's episodes)
async function getMdlSlugs(items: RequestItem[]): Promise<Map<string, string>> {
    const tmdbIds = [...new Set(items.map((i) => i.tmdbId))];
    const [showRows, seasonRows] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: tmdbIds }, mdlDisabled: false, mdlSlug: { not: "" } },
            select: { tmdbExternalId: true, mdlSlug: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { tmdbExternalId: { in: tmdbIds } },
            select: { tmdbExternalId: true, season: true, mdlSlug: true },
        }),
    ]);
    const bySeason = new Map(seasonRows.map((r) => [`${r.tmdbExternalId}-${r.season}`, r.mdlSlug]));
    const byShow = new Map(showRows.map((r) => [r.tmdbExternalId, r.mdlSlug]));

    const result = new Map<string, string>();
    for (const item of items) {
        const slug = bySeason.get(`${item.tmdbId}-${item.season}`) ?? (item.season <= 1 ? byShow.get(item.tmdbId) : undefined);
        if (slug) result.set(`${item.tmdbId}-${item.season}`, slug);
    }
    return result;
}

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id && process.env.SKIP_AUTH !== "true") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let items: RequestItem[];
    let tzOffsetMinutes = 0;
    try {
        const body = await req.json();
        items = body.items ?? [];
        // JS getTimezoneOffset convention: UTC − local, in minutes (France summer = -120)
        if (typeof body.tzOffsetMinutes === "number" && Math.abs(body.tzOffsetMinutes) <= 14 * 60) {
            tzOffsetMinutes = body.tzOffsetMinutes;
        }
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({});
    }

    // "Today" from the USER's calendar, not the server's UTC clock — otherwise a
    // yesterday-dated episode occludes today's between local midnight and UTC midnight
    const localToday = new Date(Date.now() - tzOffsetMinutes * 60_000).toISOString().split("T")[0];

    // Check DB cache for all requested items in one query
    const cacheKeys = items.map((i) => ({ mediaId: i.tmdbId, seasonNumber: i.season }));
    const cached = await getCachedNextEpisodes(cacheKeys, localToday);

    const result: Record<string, NextEpisodeResult> = {};
    const missItems: RequestItem[] = [];

    for (const item of items) {
        const key = `${item.tmdbId}-${item.season}`;
        const hit = cached.get(key);
        if (hit?.fresh) {
            // Warm cache hit — return immediately, no external call needed
            result[key] = {
                airDate: hit.airDate,
                airDateTime: hit.airDateTime,
                episodeNumber: hit.episodeNumber,
                seasonNumber: hit.seasonNumber,
                name: hit.episodeName ?? undefined,
            };
        } else {
            // Stale or missing — queue for live fetch
            missItems.push(item);
            // Return stale data optimistically while we refresh
            if (hit) {
                result[key] = {
                    airDate: hit.airDate,
                    airDateTime: hit.airDateTime,
                    episodeNumber: hit.episodeNumber,
                    seasonNumber: hit.seasonNumber,
                    name: hit.episodeName ?? undefined,
                };
            }
        }
    }

    // Fetch all misses concurrently — MDL first for linked shows, TVmaze/TMDB fallback
    if (missItems.length > 0) {
        const mdlSlugs = await getMdlSlugs(missItems);
        const fetched = await Promise.allSettled(
            missItems.map((item) =>
                fetchNextEpisodeFromApis({
                    ...item,
                    mdlSlug: mdlSlugs.get(`${item.tmdbId}-${item.season}`) ?? null,
                }),
            ),
        );

        for (let i = 0; i < missItems.length; i++) {
            const item = missItems[i];
            const key = `${item.tmdbId}-${item.season}`;
            const outcome = fetched[i];

            if (outcome.status === "fulfilled" && outcome.value) {
                const ep = outcome.value;
                // Sources can lag and still report an already-aired episode as "next"
                // (TMDB especially) — from the user's calendar that's yesterday, skip it
                if (ep.airDate >= localToday) {
                    result[key] = ep;
                } else if (!result[key]) {
                    result[key] = null;
                }

                // Persist to cache regardless (fire-and-forget — don't block the response)
                upsertCachedNextEpisode({
                    mediaId: item.tmdbId,
                    airDate: ep.airDate,
                    airDateTime: ep.airDateTime ?? null,
                    episodeNumber: ep.episodeNumber,
                    seasonNumber: ep.seasonNumber,
                    episodeName: ep.name ?? null,
                }).catch(() => {});
            } else if (outcome.status === "fulfilled") {
                // No next episode found — keep any stale result or set null
                if (!result[key]) result[key] = null;
            }
            // On rejection, leave stale result (already set above) or null
        }
    }

    return NextResponse.json(result, {
        headers: {
            "Cache-Control": "no-store",
        },
    });
}
