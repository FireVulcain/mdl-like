import { getMdlRatingHistory } from "@/lib/mdl-rating-history";

/**
 * The MDL rating's shape over the last three months, 56px wide, sitting inside
 * the badge next to the number itself.
 *
 * It answers one question — is this going up or down — and nothing else. There
 * are no axes and no labels because at this size they would be unreadable, and
 * because the number they would annotate is printed immediately to its left.
 *
 * Renders NOTHING below MIN_POINTS. MdlRatingPoint only started filling on
 * 2026-08-28 and a title gains a point on the days the cron takes it or someone
 * opens its page, so most entries have too few for a while yet. Drawing a line
 * through three dots would invent a trend; an absent sparkline says the honest
 * thing, which is that we do not know yet. Each title reveals its own when it
 * is ready — the watchlist first, since the cron forces those daily.
 */
const MIN_POINTS = 5;
const DAYS = 90;
const W = 56;
const H = 14;

export async function MdlRatingSparkline({ mdlSlug }: { mdlSlug: string }) {
    const history = await getMdlRatingHistory(mdlSlug, DAYS);
    const points = history.filter((p): p is typeof p & { rating: number } => p.rating != null);
    if (points.length < MIN_POINTS) return null;

    const values = points.map((p) => p.rating);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo;

    // Normalised to its own range, which is the whole trick: an MDL rating moves
    // in its third decimal, so a chart with an honest axis would draw a flat
    // line. Magnifying the range is what makes a month of movement legible —
    // and it is only defensible at this size, where nobody can misread a shape
    // as a quantity. The real chart later must not do this.
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => (span === 0 ? H / 2 : H - ((v - lo) / span) * H);

    // Stepped, never sloped. Days with no row mean nobody looked, not that the
    // value drifted evenly across the gap — a diagonal over a three-week hole
    // would draw a movement that was never observed.
    let d = `M 0 ${y(values[0]).toFixed(2)}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${x(i).toFixed(2)} ${y(values[i - 1]).toFixed(2)} L ${x(i).toFixed(2)} ${y(values[i]).toFixed(2)}`;
    }

    const first = values[0];
    const last = values[values.length - 1];
    const delta = last - first;

    return (
        <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            // The stroke inherits the badge's sky, so the curve reads as part of
            // the MDL group rather than as a thing of its own. Deliberately not
            // tinted by direction: the shape already says which way it went, and
            // green/red mean watched and dropped everywhere else on the site.
            className="ml-1 inline-block shrink-0 align-middle overflow-visible opacity-70"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.25}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <title>{`${first.toFixed(2)} → ${last.toFixed(2)} (${delta >= 0 ? "+" : ""}${delta.toFixed(2)}) over ${points.length} readings`}</title>
            <path d={d} />
        </svg>
    );
}
