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
export function PageBackground() {
    return (
        <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-page" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.45)_0%,transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(30,41,59,0.35)_0%,transparent_55%)]" />
            <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
            <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
            {/* Film grain. Was already on home/watchlist/login; it earns its
                keep on the darker pages too, where it hides the banding that
                large flat gradients produce on 8-bit displays. */}
            <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
                <svg width="100%" height="100%">
                    <filter id="noise">
                        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" />
                    </filter>
                    <rect width="100%" height="100%" filter="url(#noise)" />
                </svg>
            </div>
        </div>
    );
}
