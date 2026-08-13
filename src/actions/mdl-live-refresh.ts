"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { kuryanaGetDetails, parseMdlWatchers } from "@/lib/kuryana";

/**
 * Re-reads the numbers that actually move — rating, rank, popularity, watchers
 * — after the media page has rendered.
 *
 * The page always paints from cache, so this never blocks anything; it just
 * corrects the figures in place a moment later.
 *
 * The interval below is a DEBOUNCE, not a staleness window. Every genuine visit
 * refreshes; its only job is to stop a reload loop from firing a scrape per F5.
 * MDL is the party being protected here, not the freshness of the data.
 */
const DEBOUNCE_MS = 60_000;

// Only the details endpoint is called — it carries every volatile field. The
// cast endpoint is a second request and cast doesn't change, so it stays on the
// slow cachedAt cycle.
/**
 * What moved, so the caller can say so instead of just saying "something did".
 * Absent when nothing changed.
 */
export type MdlLiveChange = { from: number | null; to: number | null };
export type MdlLiveRefreshResult = {
    refreshed: boolean;
    rating?: MdlLiveChange;
    ranking?: MdlLiveChange;
    watchers?: MdlLiveChange;
};

export async function refreshMdlLiveData(
    tmdbExternalId: string,
    season?: number,
): Promise<MdlLiveRefreshResult> {
    try {
        const useSeason = season != null && season > 1;
        const row = useSeason
            ? await prisma.mdlSeasonLink.findUnique({
                  where: { tmdbExternalId_season: { tmdbExternalId, season } },
                  select: { id: true, mdlSlug: true, liveRefreshedAt: true, mdlRating: true, mdlRanking: true, mdlWatchers: true, genres: true, tags: true },
              })
            : await prisma.cachedMdlData.findUnique({
                  where: { tmdbExternalId },
                  select: { id: true, mdlSlug: true, liveRefreshedAt: true, mdlRating: true, mdlRanking: true, mdlWatchers: true, mdlDisabled: true, genres: true, tags: true },
              });

        if (!row?.mdlSlug) return { refreshed: false };
        if ("mdlDisabled" in row && row.mdlDisabled) return { refreshed: false };
        if (row.liveRefreshedAt && Date.now() - row.liveRefreshedAt.getTime() < DEBOUNCE_MS) {
            return { refreshed: false };
        }

        const details = await kuryanaGetDetails(row.mdlSlug, true);
        const d = details?.data;
        if (!d) return { refreshed: false };

        const mdlRating = d.rating != null ? parseFloat(String(d.rating)) || null : null;
        const mdlRanking = d.details?.ranked ? parseInt(d.details.ranked.replace("#", "")) : null;
        const mdlPopularity = d.details?.popularity ? parseInt(d.details.popularity.replace("#", "")) : null;
        const mdlWatchers = parseMdlWatchers(d.details?.watchers);
        const aired = d.details?.airs ?? d.details?.aired ?? null;

        // Repairs carried on the back of a request already being made.
        //
        // Season links were written without genres at all, and rows cached before
        // the scraper returned tag ids hold plain strings — which the reader turns
        // into id 0, and the media page renders an id-less tag as text rather than
        // a link. Both are visible as a missing Genres section and dead tags.
        //
        // This fetch already has the corrected values in hand, so the backfill
        // costs nothing and each row heals the first time its page is opened.
        const missingGenres = !Array.isArray(row.genres) || row.genres.length === 0;
        const legacyTags = Array.isArray(row.tags) && row.tags.some((tag) => typeof tag === "string");
        const repair =
            missingGenres || legacyTags
                ? {
                      genres: (d.others?.genres ?? []) as unknown as Prisma.InputJsonValue,
                      tags: (d.others?.tags ?? []) as unknown as Prisma.InputJsonValue,
                  }
                : {};

        // cachedAt is left alone on purpose — see the schema comment. Touching it
        // would keep pushing the cast/synopsis refresh out of reach.
        const data = { mdlRating, mdlRanking, mdlPopularity, mdlWatchers, aired, liveRefreshedAt: new Date(), ...repair };
        if (useSeason) {
            await prisma.mdlSeasonLink.update({ where: { id: row.id }, data });
        } else {
            await prisma.cachedMdlData.update({ where: { id: row.id }, data });
        }

        // Only ask the page to re-render when a visible number actually moved
        const changed =
            mdlRating !== row.mdlRating ||
            mdlRanking !== row.mdlRanking ||
            mdlWatchers !== row.mdlWatchers ||
            // A repaired row has new sections to draw, even if no number moved.
            Object.keys(repair).length > 0;
        const moved: Omit<MdlLiveRefreshResult, "refreshed"> = {};
        if (mdlRating !== row.mdlRating) moved.rating = { from: row.mdlRating, to: mdlRating };
        if (mdlRanking !== row.mdlRanking) moved.ranking = { from: row.mdlRanking, to: mdlRanking };
        if (mdlWatchers !== row.mdlWatchers) moved.watchers = { from: row.mdlWatchers, to: mdlWatchers };

        // router.refresh() alone was updating the row but not the screen: the new
        // value only showed up on the NEXT full load. The route has to be
        // invalidated server-side too, otherwise the refetch can be answered with
        // the payload rendered before the write.
        if (changed) revalidatePath(`/media/tmdb-${tmdbExternalId}`);

        return { refreshed: changed, ...moved };
    } catch {
        // A failed scrape must never surface on a page that already rendered fine
        return { refreshed: false };
    }
}
