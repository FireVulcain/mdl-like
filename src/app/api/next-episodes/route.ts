import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
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
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
    seasonEpisodeCount?: number;
} | null;

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
                    episodeNumber: hit.episodeNumber,
                    seasonNumber: hit.seasonNumber,
                    name: hit.episodeName ?? undefined,
                };
            }
        }
    }

    // Fetch all misses concurrently
    if (missItems.length > 0) {
        const fetched = await Promise.allSettled(missItems.map((item) => fetchNextEpisodeFromApis(item)));

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
