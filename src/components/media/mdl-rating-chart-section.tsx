import { getMdlRatingHistory } from "@/lib/mdl-rating-history";
import { MdlRatingChart, type ChartPoint } from "./mdl-rating-chart";

/**
 * The rating history as a section of its own, rather than the glance the badge
 * offers.
 *
 * The badge's popover answers "which way is this going". This answers "what
 * happened, and when" — it has the room for a real time axis, labelled ticks
 * that disclose how much the tight scale is magnifying, and the audience
 * underneath, which is the only way to see whether a score slid as the crowd
 * widened.
 *
 * Same reveal rule as everything else built on this table: absent until the
 * title has earned enough history, then it appears on its own. MIN_POINTS is
 * higher here than in the badge because a section with a heading makes a
 * promise a three-dot chart cannot keep — one is a glance you can dismiss, the
 * other is a destination someone scrolled to.
 */
const MIN_POINTS = 8;
const DAYS = 365;

export async function MdlRatingChartSection({ mdlSlug }: { mdlSlug: string }) {
    const history = await getMdlRatingHistory(mdlSlug, DAYS);

    const points: ChartPoint[] = history
        .filter((p) => p.rating != null || p.watchers != null)
        // A plain YYYY-MM-DD across the wire. The column is a DATE with no time
        // in it, and sending an instant invites the client to shift it by a
        // timezone the reading never had.
        .map((p) => ({ day: p.day.toISOString().slice(0, 10), rating: p.rating, watchers: p.watchers }));

    if (points.length < MIN_POINTS) return null;

    const rated = points.filter((p) => p.rating != null);
    if (rated.length < 2) return null;
    // A flat series is not a history worth a section. The back catalogue sits
    // here: MDL publishes one decimal, so a title on tens of thousands of votes
    // never moves, and a straight line under a heading reads as a bug.
    if (new Set(rated.map((p) => p.rating)).size < 2) return null;

    const first = rated[0].rating as number;
    const last = rated[rated.length - 1].rating as number;
    const delta = Math.round((last - first) * 10) / 10;
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const withWatchers = points.filter((p) => p.watchers != null).length;

    return (
        <div>
            <div className="mb-4 flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2">
                    <h3 className="font-display text-lg font-semibold text-fg">Rating history</h3>
                    <span className="text-xs tabular-nums text-sky-400">
                        {sign}
                        {Math.abs(delta).toFixed(1)}
                    </span>
                </div>
                <span className="text-[11px] text-fg-dim">
                    {rated.length} readings
                    {withWatchers > 1 ? " · audience shaded" : ""}
                </span>
            </div>

            <MdlRatingChart points={points} />

            {/* The sampling is uneven by design and the chart cannot say so on
                its own. The cron forces the watchlist through daily and takes
                everything else at six days or older, so the dots cluster where
                someone was paying attention. */}
            <p className="mt-2 text-[11px] leading-snug text-fg-faint">
                Each dot is a day the rating was read. Between two dots the line holds the last known value — a gap is a stretch nobody looked, not a
                stretch nothing happened.
            </p>
        </div>
    );
}
