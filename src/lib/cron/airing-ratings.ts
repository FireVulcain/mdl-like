import { kuryanaGetTop, kuryanaGetDetails, kuryanaGetRatings, parseMdlWatchers, type KuryanaTopSelection } from "@/lib/kuryana";
import { backfillMdlRatings, recordMdlRatingPoint } from "@/lib/mdl-rating-history";

export type AiringRatingsResult = {
    task: "record-airing-ratings";
    success: boolean;
    /** Titles that got a point today. */
    count?: number;
    /** How many of those carried watchers and rank, not just a rating. */
    detailed?: number;
    /** Past days filled in from MDL's own statistics page. */
    backfilled?: number;
    pages?: number;
    error?: string;
    duration: number;
};

/**
 * Two countries, deliberately, and not whichever ones happen to be cached.
 *
 * Every country here is another set of daily requests against a site that
 * blocks us when pushed, so the number is chosen rather than inherited from the
 * home page's settings. Korean and Chinese are where the watching actually
 * happens. Widening this is one line, and the price of each is known: korean
 * airs about twenty-seven shows across two pages, chinese ten across one.
 */
const AIRING_COUNTRIES: KuryanaTopSelection[] = ["korean", "chinese"];

/**
 * A ceiling on top of the scraper's own page count.
 *
 * total_pages is trusted for how far to walk, but not blindly: a parser fooled
 * by a layout change could report a number with no bound behind it, and this
 * job would then spend its morning walking empty pages at MDL. Five is far
 * above any real airing season.
 */
const MAX_PAGES = 5;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A daily reading for every drama currently airing, whether or not anybody here
 * is watching it.
 *
 * Everything else feeding MdlRatingPoint is driven by the watchlist, so the
 * history was only ever going to describe one person's taste. Airing shows are
 * the opposite population and the better one: they collect votes quickly, so
 * their ratings genuinely move — the back catalogue's cannot, MDL publishing a
 * single decimal and those titles resting on tens of thousands of votes.
 *
 * Two passes, because the two endpoints know different things.
 *
 * The lists find the titles. They are already scraped for the home page, but
 * reading them out of CachedMdlTop would be wrong: that cache only refreshes
 * when somebody opens the home page, so a stale figure would go in under
 * today's date and a stored day would stop meaning "we looked" — the one
 * promise the table makes.
 *
 * The detail page then supplies the numbers, and it is watchers that make that
 * second call worth its cost — the list does not carry them at all, and without
 * them this population would have a rating and nothing to read it against.
 *
 * Note for anyone tempted to skip the detail call and take the list's `rank`
 * instead: it would in fact be correct. Checked against the pages themselves,
 * the list's rank is `details.ranked` exactly — 3718 and 3610 on both sides —
 * and the detail page's separate `popularity` is a different number entirely
 * (2262, 2297). `media.service.ts` maps that rank onto `UnifiedMedia.popularity`,
 * which is a mislabelling, and believing it is what sent an earlier version of
 * this file recording ratings alone. The second call stays for the watchers.
 *
 * A failed detail call falls back to the list's rating rather than losing the
 * day. A thinner reading is worth more than a hole.
 *
 * A third call then fills the past. MDL's statistics page publishes its own
 * daily rating for the last thirteen days, which is the only view of a history
 * we did not observe ourselves — one request backfills a fortnight. Calling it
 * every day rather than once also keeps that fortnight complete however many
 * days this job missed, so the recent history repairs itself.
 *
 * It writes the rating column and nothing else: the page carries no watchers
 * and no rank, and storing those as null would erase what the detail call had
 * just recorded.
 */
export async function recordAiringRatings(): Promise<AiringRatingsResult> {
    const started = Date.now();

    try {
        // slug -> the rating the list gave, kept as the fallback below.
        const found = new Map<string, number>();
        let pages = 0;

        for (const country of AIRING_COUNTRIES) {
            let totalPages = 1;

            for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
                try {
                    const res = await kuryanaGetTop(country, "ongoing", { sort: "popular", page });
                    pages++;

                    // Read on the first page and then held: asking each page how
                    // many there are lets a single odd response cut the walk short.
                    if (page === 1) totalPages = res?.data.pagination?.total_pages ?? 1;

                    for (const show of res?.data.shows ?? []) {
                        const slug = show.url?.replace(/^\//, "");
                        // A show that has just begun has no rating yet — too few
                        // votes for MDL to publish one. The zero it comes back
                        // as is an absence, not a reading of nought out of ten.
                        if (!slug || !show.rating || found.has(slug)) continue;
                        found.set(slug, show.rating);
                    }
                } catch (e) {
                    // One page failing must not cost the rest of the country.
                    console.error(`[Cron airing] List failed ${country} p${page}:`, e);
                }

                await delay(500);
            }
        }

        let count = 0;
        let detailed = 0;
        let backfilled = 0;

        for (const [slug, listRating] of found) {
            try {
                const details = await kuryanaGetDetails(slug, true);
                const d = details?.data;

                if (d) {
                    const rating = d.rating != null ? parseFloat(String(d.rating)) || null : null;
                    const ranked = d.details?.ranked;
                    await recordMdlRatingPoint(slug, {
                        rating: rating ?? listRating,
                        ranking: ranked ? parseInt(ranked.replace("#", "")) : null,
                        watchers: parseMdlWatchers(d.details?.watchers),
                    });
                    detailed++;
                } else {
                    await recordMdlRatingPoint(slug, { rating: listRating });
                }
                count++;
            } catch (e) {
                console.error(`[Cron airing] Detail failed ${slug}:`, e);
                await recordMdlRatingPoint(slug, { rating: listRating });
                count++;
            }

            await delay(500);

            // The past, after the present. Deliberately its own try: a failure
            // here must not lose the reading just taken above.
            try {
                const stats = await kuryanaGetRatings(slug);
                const series = stats?.data?.overall_ratings ?? [];
                if (series.length) backfilled += await backfillMdlRatings(slug, series);
            } catch (e) {
                console.error(`[Cron airing] Ratings failed ${slug}:`, e);
            }

            await delay(500);
        }

        return { task: "record-airing-ratings", success: true, count, detailed, backfilled, pages, duration: Date.now() - started };
    } catch (error) {
        return {
            task: "record-airing-ratings",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - started,
        };
    }
}
