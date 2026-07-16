import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCachedNextEpisodes, upsertCachedNextEpisode } from "@/lib/next-episode-cache";
import { fetchNextEpisodeFromApis } from "@/lib/next-episode-fetch";

// Background refresh (after()) counts toward the function duration
export const maxDuration = 60;

// Keys currently being refreshed in the background (per server instance) —
// re-polls and concurrent tabs must not schedule duplicate scrapes
const inFlightKeys = new Set<string>();

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

    // Misses are refreshed AFTER the response — kuryana scrapes an MDL page per
    // show (seconds each), and blocking on ~15 of them left the watchlist with
    // no indicators for 30s+. Instead: answer from cache instantly, persist the
    // fresh data in the background, and tell the client which keys to re-poll.
    // Keys already being fetched (previous request or re-poll) are skipped so
    // polling can't stack duplicate scrape storms.
    const pending = missItems.map((item) => `${item.tmdbId}-${item.season}`);
    const toFetch = missItems.filter((item) => !inFlightKeys.has(`${item.tmdbId}-${item.season}`));

    if (toFetch.length > 0) {
        toFetch.forEach((item) => inFlightKeys.add(`${item.tmdbId}-${item.season}`));
        const mdlSlugs = await getMdlSlugs(toFetch);
        after(async () => {
            try {
                // Small chunks: keeps the process responsive and kuryana happy
                const CONCURRENCY = 4;
                for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
                    const chunk = toFetch.slice(i, i + CONCURRENCY);
                    await Promise.allSettled(
                        chunk.map(async (item) => {
                            const ep = await fetchNextEpisodeFromApis({
                                ...item,
                                mdlSlug: mdlSlugs.get(`${item.tmdbId}-${item.season}`) ?? null,
                            });
                            if (!ep) return;
                            // Aired-yesterday entries from lagging sources are filtered at read time
                            await upsertCachedNextEpisode({
                                mediaId: item.tmdbId,
                                airDate: ep.airDate,
                                airDateTime: ep.airDateTime ?? null,
                                episodeNumber: ep.episodeNumber,
                                seasonNumber: ep.seasonNumber,
                                episodeName: ep.name ?? null,
                            });
                        }),
                    );
                }
            } finally {
                toFetch.forEach((item) => inFlightKeys.delete(`${item.tmdbId}-${item.season}`));
            }
        });
    }

    return NextResponse.json(
        { results: result, pending },
        {
            headers: {
                "Cache-Control": "no-store",
            },
        },
    );
}
