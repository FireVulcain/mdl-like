/**
 * The shape of a person page, shown the instant one is asked for.
 *
 * This page streams almost nothing — two boundaries, for the photos and the
 * discussions, against nineteen on a media page. The name, the portrait and the
 * whole filmography all wait for the same server render, and a person MDL has
 * not cached recently costs a scrape of around half a second before any of it
 * can start.
 *
 * Without a loading file that wait happened on the page you were leaving, with
 * nothing to show it had begun. This turns it into a page filling in.
 *
 * Built on the real page's measurements — the 280px sidebar, the 2:3 portrait,
 * the six-column filmography grid — so nothing shifts when the content lands.
 */
export default function Loading() {
    const card = (
        <div className="space-y-2">
            <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-white/5" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-white/5" />
        </div>
    );

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-8 m-auto px-4 md:px-6">
                <div className="h-5 w-28 animate-pulse rounded bg-white/5" />

                <div className="md:grid md:gap-8 md:grid-cols-[280px_1fr]">
                    {/* Mobile header: portrait beside the name */}
                    <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                        <div className="aspect-2/3 animate-pulse rounded-lg bg-white/5" />
                        <div className="space-y-2 py-1">
                            <div className="h-5 w-2/3 animate-pulse rounded bg-white/5" />
                            <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                        </div>
                    </div>

                    {/* Desktop sidebar: portrait, then the details panel */}
                    <div className="hidden md:block space-y-4">
                        <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-white/5" />
                        <div className="h-40 w-full animate-pulse rounded-xl bg-white/5" />
                    </div>

                    <div className="space-y-8">
                        <div className="hidden md:block space-y-3">
                            <div className="h-8 w-1/2 animate-pulse rounded bg-white/5" />
                            <div className="h-4 w-1/4 animate-pulse rounded bg-white/5" />
                        </div>

                        {/* Section nav */}
                        <div className="flex gap-2">
                            {[72, 60, 64].map((w) => (
                                <div key={w} className="h-9 animate-pulse rounded-lg bg-white/5" style={{ width: w }} />
                            ))}
                        </div>

                        {/* Biography */}
                        <div className="space-y-2">
                            {["100%", "95%", "88%", "45%"].map((w) => (
                                <div key={w} className="h-3 animate-pulse rounded bg-white/5" style={{ width: w }} />
                            ))}
                        </div>

                        {/* Filmography, the bulk of the page */}
                        {[0, 1].map((section) => (
                            <div key={section} className="space-y-4">
                                <div className="h-5 w-40 animate-pulse rounded bg-white/5" />
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {Array.from({ length: 12 }, (_, i) => <div key={i}>{card}</div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
