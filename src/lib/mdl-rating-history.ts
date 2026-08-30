import { prisma } from "@/lib/prisma";

/**
 * Which calendar day a reading belongs to.
 *
 * Europe/Paris rather than UTC, and rather than the server's own clock. UTC was
 * the first answer and it was wrong in a way that showed: a rating read at
 * 01:00 in France is 23:00 the day before in UTC, so it was filed under
 * yesterday and overwrote yesterday's reading. Naming the zone explicitly keeps
 * the value stable however the host is configured — which was the only real
 * virtue UTC had here — while agreeing with the calendar of the person reading
 * the chart.
 *
 * en-CA formats as YYYY-MM-DD, which is then pinned to UTC midnight because the
 * column is a DATE and the time is discarded on the way in regardless.
 */
const DAY_ZONE = "Europe/Paris";
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: DAY_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

function today0(): Date {
    return new Date(`${dayFormatter.format(new Date())}T00:00:00.000Z`);
}

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

    const day = today0();

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

const STATS_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Aug 18" into a day, with the year worked out.
 *
 * MDL's statistics page prints no year, and the window only ever looks
 * backwards — so a date that would land in the future belongs to last year.
 * That case appears for about a fortnight every January and never otherwise,
 * which is exactly the kind of bug that sleeps for eleven months.
 */
function resolveStatsDay(labelText: string, today: Date): Date | null {
    const m = /^([A-Za-z]{3})\s+(\d{1,2})$/.exec(labelText.trim());
    if (!m) return null;
    const month = STATS_MONTHS.indexOf(m[1]);
    const dayOfMonth = Number(m[2]);
    if (month < 0 || !Number.isFinite(dayOfMonth)) return null;

    const year = today.getUTCFullYear();
    const candidate = new Date(Date.UTC(year, month, dayOfMonth));
    if (candidate.getTime() > today.getTime() + 2 * 86_400_000) {
        return new Date(Date.UTC(year - 1, month, dayOfMonth));
    }
    return candidate;
}

/**
 * Fills the last thirteen days from MDL's own statistics page.
 *
 * This is the only source of a past we did not observe ourselves, so it is
 * worth more than it costs: one request per title backfills a fortnight, and
 * calling it daily keeps that fortnight complete however many days our own cron
 * missed. The history repairs itself.
 *
 * **Only the rating column is written.** recordMdlRatingPoint sets all three at
 * once, which is right when it has all three in hand and destructive here —
 * this endpoint carries no watchers and no rank, and an upsert of those as null
 * would erase readings the detail call had just made.
 *
 * A rating of 0 is skipped: it means the title had too few votes to be scored
 * that day, not that it scored nothing.
 */
export async function backfillMdlRatings(mdlSlug: string, entries: { date: string; rating: number }[]): Promise<number> {
    if (!mdlSlug || entries.length === 0) return 0;

    const today = today0();
    let written = 0;

    for (const entry of entries) {
        if (!entry?.rating) continue;
        const day = resolveStatsDay(entry.date, today);
        if (!day) continue;

        try {
            await prisma.mdlRatingPoint.upsert({
                where: { mdlSlug_day: { mdlSlug, day } },
                create: { mdlSlug, day, rating: entry.rating },
                update: { rating: entry.rating },
            });
            written++;
        } catch {
            // One day failing must not cost the other twelve.
        }
    }

    return written;
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
