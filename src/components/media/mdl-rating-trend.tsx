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
 */
const MIN_POINTS = 5;
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

    return <MdlRatingTrendPopover points={points} />;
}
