import { kuryanaGetTop, type KuryanaTopSelection } from "@/lib/kuryana";
import { recordMdlRatingPoint } from "@/lib/mdl-rating-history";

export type AiringRatingsResult = {
    task: "record-airing-ratings";
    success: boolean;
    count?: number;
    countries?: number;
    error?: string;
    duration: number;
};

/**
 * Two countries, deliberately, and not whichever ones happen to be cached.
 *
 * Every country here is another daily request against a site that blocks us
 * when pushed, so the number is chosen rather than inherited from the home
 * page's settings. Korean and Chinese are where the watching actually happens.
 * Widening this is one line, and the price of each is known: korean returns
 * about twenty shows with thirteen rated, chinese ten with five.
 */
const AIRING_COUNTRIES: KuryanaTopSelection[] = ["korean", "chinese"];

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
 * The lists are already scraped for the home page, but reading them out of
 * CachedMdlTop would be wrong: that cache only refreshes when somebody opens
 * the home page, so a stale figure would go in under today's date and a stored
 * day would stop meaning "we looked" — the one promise the table makes.
 *
 * Rating only. The list's `rank` is MDL's popularity rank — media.service maps
 * it to `popularity` and the values run into the tens of thousands — while our
 * `ranking` column holds the rating rank from `details.ranked`. Filing one
 * under the other would quietly corrupt every rank series we have.
 */
export async function recordAiringRatings(): Promise<AiringRatingsResult> {
    const started = Date.now();

    try {
        const seen = new Set<string>();
        let count = 0;

        for (const country of AIRING_COUNTRIES) {
            try {
                const res = await kuryanaGetTop(country, "ongoing", { sort: "popular" });
                for (const show of res?.data.shows ?? []) {
                    const slug = show.url?.replace(/^\//, "");
                    // A show that has just begun has no rating yet — too few
                    // votes for MDL to publish one. Storing the zero it comes
                    // back as would invent a reading of nought out of ten.
                    if (!slug || seen.has(slug) || !show.rating) continue;
                    seen.add(slug);
                    await recordMdlRatingPoint(slug, { rating: show.rating });
                    count++;
                }
            } catch (e) {
                // One country failing must not cost the others theirs.
                console.error(`[Cron airing] Failed ${country}:`, e);
            }

            await delay(500);
        }

        return { task: "record-airing-ratings", success: true, count, countries: AIRING_COUNTRIES.length, duration: Date.now() - started };
    } catch (error) {
        return {
            task: "record-airing-ratings",
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - started,
        };
    }
}
