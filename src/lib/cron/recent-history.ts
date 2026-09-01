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
 * How recently a title has to have finished to be worth a daily reading, or
 * null to take every completed title regardless of age.
 *
 * **Currently null — a deliberate experiment, and 365 is the value to restore.**
 * The argument for the limit still stands and is worth keeping to hand:
 * measured across the 165 completed titles in this watchlist, 10 ended within
 * three months, 26 within the year and 115 more than a year ago. Those 115 gain
 * a few dozen watchers a month, so a daily reading writes 365 nearly identical
 * points a year for a curve four points could draw — and it triples the daily
 * request count against a site that blocks us when pushed.
 *
 * What the experiment is for: an audience curve on the old back catalogue is
 * currently two points, and two points are not a curve however they are drawn.
 * Whether a denser one turns out to be worth looking at is a question only a
 * few weeks of real data can answer.
 */
const RECENT_DAYS: number | null = null;

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
 * It is currently taking every completed title, on trial — see RECENT_DAYS,
 * which carries the case for the limit and the value to put back.
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

        const cutoff = RECENT_DAYS === null ? 0 : Date.now() - RECENT_DAYS * 86_400_000;
        const slugs = new Set<string>();
        for (const row of [...shows, ...seasons]) {
            if (RECENT_DAYS === null) {
                slugs.add(row.mdlSlug);
                continue;
            }
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
