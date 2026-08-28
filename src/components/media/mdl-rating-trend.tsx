import { getMdlRatingHistory } from "@/lib/mdl-rating-history";
import { MdlRatingTrendPopover, type TrendPoint } from "./mdl-rating-trend-popover";

/**
 * Loads the rating history and hands it to the popover.
 *
 * Renders NOTHING below MIN_POINTS, and that is the whole deployment strategy.
 * MdlRatingPoint only started filling on 2026-08-28, and a title gains a point
 * on the days the cron takes it or somebody opens its page — so this is
 * invisible almost everywhere today and reveals itself title by title, the
 * watchlist first since the cron forces those daily. Drawing a chart through
 * three dots would invent a trend; an absent icon says the honest thing, which
 * is that we do not know yet.
 *
 * It also renders nothing when the reading never changed, which is the ordinary
 * case for the back catalogue rather than an edge one. MDL publishes ratings to
 * a single decimal — measured across 851 cached titles, not one carries a
 * second — so a 2015 drama sitting on tens of thousands of votes would need a
 * landslide to move 8.4 to 8.5. A point is stored every day regardless, so
 * without this guard those titles would grow an icon after five days and open
 * onto a flat line reading 0.00: a control promising a movement it does not
 * have. Their rank and audience do keep moving; the rating does not.
 */
// Three, not five. Five was a guess made before the guard below existed; now
// that a series has to carry two distinct readings to show at all, the real
// risk — a flat line pretending to be a trend — is already handled, and the
// threshold was only delaying an honest chart. Three readings that went
// 8.2, 8.4, 8.5 are a chart worth opening.
const MIN_POINTS = 3;
const DAYS = 90;

export async function MdlRatingTrend({ mdlSlug }: { mdlSlug: string }) {
    const history = await getMdlRatingHistory(mdlSlug, DAYS);

    const points: TrendPoint[] = history
        .filter((p): p is typeof p & { rating: number } => p.rating != null)
        // The Date goes across the wire as a plain YYYY-MM-DD. It is a DATE
        // column with no time in it, and serialising it as an instant invites
        // the client to shift it by a timezone it never had.
        .map((p) => ({ day: p.day.toISOString().slice(0, 10), rating: p.rating }));

    if (points.length < MIN_POINTS) return null;
    if (new Set(points.map((p) => p.rating)).size < 2) return null;

    return <MdlRatingTrendPopover points={points} />;
}
