import { prisma } from "@/lib/prisma";
import { kuryanaGetDetails, parseMdlWatchers } from "@/lib/kuryana";
import { recordMdlRatingPoint } from "@/lib/mdl-rating-history";
import { airedEndDate } from "@/lib/format-aired";

export type RecentHistoryResult = {
    task: "record-recent-history";
    success: boolean;
    /** Finished titles young enough to still be moving. */
    eligible?: number;
    /** Of those, how many got a reading today. */
    count?: number;
    error?: string;
    duration: number;
};

/**
 * How recently a title has to have finished to be worth a daily reading.
 *
 * Measured across the 165 completed titles in this watchlist: 10 ended within
 * three months, 26 within the year, and 115 more than a year ago. The old ones
 * gain a few dozen watchers a month — a daily reading would write 365 nearly
 * identical points a year for a curve four points could draw. A year is the
 * line where a series stops being alive.
 */
const RECENT_DAYS = 365;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A daily reading for the titles that have finished but are still moving.
 *
 * The gap this fills is watchers, not ratings. MDL's statistics page backfills
 * a fortnight of ratings for anything, but it carries no audience figure at
 * all — the only place that exists is a title's own detail page, which nothing
 * opens daily for a finished show. Measured before this job: 9.8 ratings per
 * title against 2.1 watchers readings, and 186 titles with exactly two. Two
 * points are not a curve however they are drawn.
 *
 * Deliberately not every completed title. The ones that ended years ago gain a
 * fraction of a per cent a week, and taking all 172 would have meant 172 daily
 * requests against a site that blocks us when pushed — for a line that would
 * look the same either way. Restricting it to the last year cuts that to about
 * thirty-six.
 *
 * A title whose aired range cannot be read is kept rather than dropped. MDL
 * writes something else entirely for films and irregular broadcasts, and one
 * extra request costs less than a title silently left out.
 */
export async function recordRecentlyFinished(): Promise<RecentHistoryResult> {
    const started = Date.now();

    try {
        const items = await prisma.userMedia.findMany({
            where: { status: "Completed" },
            select: { externalId: true },
            distinct: ["externalId"],
        });
        const ids = items.map((i) => i.externalId);
        if (ids.length === 0) {
            return { task: "record-recent-history", success: true, eligible: 0, count: 0, duration: Date.now() - started };
        }

        // Both tables carry a slug and an aired range: MDL files each season as
        // its own entry, so a linked season is its own series with its own end.
        const [shows, seasons] = await Promise.all([
            prisma.cachedMdlData.findMany({
                where: { tmdbExternalId: { in: ids }, mdlSlug: { not: "" }, mdlDisabled: false },
                select: { mdlSlug: true, aired: true },
            }),
            prisma.mdlSeasonLink.findMany({
                where: { tmdbExternalId: { in: ids }, mdlSlug: { not: "" } },
                select: { mdlSlug: true, aired: true },
            }),
        ]);

        const cutoff = Date.now() - RECENT_DAYS * 86_400_000;
        const slugs = new Set<string>();
        for (const row of [...shows, ...seasons]) {
            const end = airedEndDate(row.aired);
            // No readable end date means keep it — see the note above.
            if (end === null || end.getTime() >= cutoff) slugs.add(row.mdlSlug);
        }

        let count = 0;
        for (const slug of slugs) {
            try {
                const details = await kuryanaGetDetails(slug, true);
                const d = details?.data;
                if (d) {
                    const rating = d.rating != null ? parseFloat(String(d.rating)) || null : null;
                    const ranked = d.details?.ranked;
                    await recordMdlRatingPoint(slug, {
                        rating,
                        ranking: ranked ? parseInt(ranked.replace("#", "")) : null,
                        watchers: parseMdlWatchers(d.details?.watchers),
                    });
                    count++;
                }
            } catch (e) {
                // One title failing must not cost the rest of the run.
                console.error(`[Cron history] Failed ${slug}:`, e);
            }

            await delay(600);
        }

        return { task: "record-recent-history", success: true, eligible: slugs.size, count, duration: Date.now() - started };
    } catch (error) {
        return {
            task: "record-recent-history",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - started,
        };
    }
}
