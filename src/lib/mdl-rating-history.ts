import { prisma } from "@/lib/prisma";

/**
 * Records one day's reading of an MDL entry's volatile numbers.
 *
 * MDL serves only the current value — there is no archive to fetch and no way
 * to reconstruct a day we failed to store. So this runs on the back of the
 * scrapes we already make rather than on a schedule of its own: every live
 * refresh and every cron pass drops its numbers here as it goes.
 *
 * The write is an upsert on (mdlSlug, day), not an append. Callers fire far
 * more often than once a day — the live refresh debounces at 60s and watchers
 * moves constantly — so appending would write dozens of rows an hour for a
 * single reader holding F5. The last reading of a day wins.
 *
 * Never throws. A history point is worth less than the refresh carrying it, so
 * a failure here must not take down the caller's own work.
 */
export async function recordMdlRatingPoint(
    mdlSlug: string,
    values: { rating?: number | null; ranking?: number | null; watchers?: number | null },
): Promise<void> {
    // A reading with nothing in it is not an observation, it is a failed scrape
    // wearing one. Storing it would put a hole in the middle of a series and
    // make it look like the numbers vanished for a day.
    if (values.rating == null && values.ranking == null && values.watchers == null) return;
    if (!mdlSlug) return;

    // Midnight UTC. The column is a DATE, so the time is dropped on the way in
    // anyway — pinning it here keeps the value the unique index sees stable
    // whatever the server's local offset happens to be.
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);

    const point = {
        rating: values.rating ?? null,
        ranking: values.ranking ?? null,
        watchers: values.watchers ?? null,
    };

    try {
        await prisma.mdlRatingPoint.upsert({
            where: { mdlSlug_day: { mdlSlug, day } },
            create: { mdlSlug, day, ...point },
            update: point,
        });
    } catch {
        // Deliberately silent — see above.
    }
}

export type MdlRatingPoint = {
    day: Date;
    rating: number | null;
    ranking: number | null;
    watchers: number | null;
};

/**
 * The series for one entry, oldest first.
 *
 * Days are missing wherever nobody looked, which is most days for most titles:
 * the cron only forces "Watching" and "Plan to Watch" through, and everything
 * else is picked up at ≥6 days old or when someone opens its page. A chart over
 * this has to step between points — drawing a slope across a three-week gap
 * would invent a movement that was never observed.
 */
export async function getMdlRatingHistory(mdlSlug: string, days = 365): Promise<MdlRatingPoint[]> {
    if (!mdlSlug) return [];
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days);

    return prisma.mdlRatingPoint.findMany({
        where: { mdlSlug, day: { gte: since } },
        select: { day: true, rating: true, ranking: true, watchers: true },
        orderBy: { day: "asc" },
    });
}
