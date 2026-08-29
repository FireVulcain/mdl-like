// The site's backdrop, fixed to the viewport and shared by every page.
//
// It used to be copy-pasted into each page, which let it drift (stats had a
// purple bottom glow, settings had none, two pages still used w-[500px]).
//
// The base colour lives in --page-bg (globals.css) so the hero fades and
// ring-offsets that blend into the page stay in sync with it.
//
// Both ends of the viewport get a lift: with only the original top ellipse,
// everything below its 50% stop fell back to the bare base colour, so the
// bottom of the screen — most visible at the end of a page — read as flat black.
//
// EVERYTHING HERE IS COMPOSITED ON EVERY SCROLL FRAME, because the layer is
// fixed while the content above it moves. On mobile that budget is small: the
// original version paired a full-viewport overlay blend mode with a live
// feTurbulence filter, and the GPU dropped tiles mid-scroll — content visibly
// vanished and repainted. Keep this layer cheap: no blend modes, no live SVG
// filters, and blur radii no larger than they need to be.
//
// (Naming a utility class in a comment is enough for Tailwind to emit it —
// hence the prose above rather than the literal class.)

// The grain, rasterised once as a tiling background rather than a live filter
// element. Same fractalNoise, but the browser decodes it once and repeats it;
// stitchTiles keeps the seams invisible.
const GRAIN =
    'url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22160%22%20height%3D%22160%22%3E%3Cfilter%20id%3D%22n%22%3E%3CfeTurbulence%20type%3D%22fractalNoise%22%20baseFrequency%3D%220.7%22%20numOctaves%3D%224%22%20stitchTiles%3D%22stitch%22%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D%22160%22%20height%3D%22160%22%20filter%3D%22url(%2523n)%22%2F%3E%3C%2Fsvg%3E")';

export function PageBackground() {
    return (
        <div className="fixed inset-0 -z-10 pointer-events-none">
            <div className="absolute inset-0 bg-page" />
            {/* The two lifts read their colour from the theme now: slate on the
                dark canvas, white on the light one. Depth on a light ground
                comes from light, not from more grey. */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--page-lift-top)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,var(--page-lift-bottom)_0%,transparent_55%)]" />
            {/* No coloured glow. Two blurred blue ellipses sat here, and one more
                per home section on top of them — seven soft blue and violet halos
                on one page, which is the single loudest thing a generated design
                does. The two radial lifts above stay: they are the page's own
                grey, and they do a job — without them the bottom of a long page
                reads as flat black. Colour comes from the artwork now. */}
            <div className="absolute inset-0 opacity-[0.035]" style={{ backgroundImage: GRAIN, backgroundRepeat: "repeat" }} />
        </div>
    );
}
