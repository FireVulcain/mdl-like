export type PathPoint = { x: number; y: number };

/**
 * An SVG path curving through every point, without inventing a shape.
 *
 * Monotone cubic interpolation — Fritsch–Carlson — rather than the Catmull-Rom
 * most smoothing helpers reach for. The difference is the whole reason this
 * exists: a cardinal spline overshoots, so three readings of 8.2, 8.2 and 8.4
 * come out with a dip below 8.2 before the climb. That dip is a rating the
 * title never had, drawn confidently, and on a chart whose entire subject is
 * whether a number went up or down it is not a cosmetic difference.
 *
 * The Fritsch–Carlson tangents are chosen so the curve never leaves the range
 * of the points on either side of it: flat between equal readings, and rising
 * only where the data rises. Every peak and every trough on the drawn line is a
 * peak or trough that was actually measured.
 *
 * What it still costs is the values in between. Between 8.2 and 8.4 the curve
 * passes through 8.27, and MDL publishes a single decimal — so those points are
 * a reading of the shape rather than of the data. Fine for an audience counter,
 * which really does pass through everything on the way; a considered trade for
 * a rating, where the alternative is a staircase.
 */
export function smoothPath(points: PathPoint[]): string {
    const n = points.length;
    if (n === 0) return "";

    const head = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
    if (n === 1) return head;
    // Two points have no curvature to speak of, and a spline through them is a
    // straight line with extra arithmetic.
    if (n === 2) return `${head} L ${points[1].x.toFixed(2)} ${points[1].y.toFixed(2)}`;

    const dx: number[] = [];
    const secant: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        dx[i] = points[i + 1].x - points[i].x;
        // Two readings at the same x would divide by zero. It should not happen
        // — a day is unique — but a flat segment is the right answer if it does.
        secant[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
    }

    const tangent: number[] = new Array(n);
    tangent[0] = secant[0];
    tangent[n - 1] = secant[n - 2];

    for (let i = 1; i < n - 1; i++) {
        // A change of direction, or a flat run: pin the tangent to zero so the
        // curve turns at the point instead of sailing past it.
        if (secant[i - 1] * secant[i] <= 0) {
            tangent[i] = 0;
            continue;
        }
        const w1 = 2 * dx[i] + dx[i - 1];
        const w2 = dx[i] + 2 * dx[i - 1];
        tangent[i] = (w1 + w2) / (w1 / secant[i - 1] + w2 / secant[i]);
    }

    let d = head;
    for (let i = 0; i < n - 1; i++) {
        const third = dx[i] / 3;
        const c1x = points[i].x + third;
        const c1y = points[i].y + tangent[i] * third;
        const c2x = points[i + 1].x - third;
        const c2y = points[i + 1].y - tangent[i + 1] * third;
        d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`;
    }
    return d;
}
