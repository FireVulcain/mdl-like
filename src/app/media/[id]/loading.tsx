/**
 * The shape of a media page, shown the instant one is asked for.
 *
 * Without a loading file a client-side navigation does not commit until the
 * server has finished the whole route, so clicking a title from the watchlist
 * left the reader on the watchlist for about a second — the progress bar
 * running honestly, because the navigation genuinely had not started. The
 * nineteen Suspense boundaries inside the page could not help: they cannot
 * stream before the shell they live in has arrived.
 *
 * This is that shell. It turns the wait into a page that is filling in rather
 * than a page that has not begun, and it is what lets everything behind it
 * stream instead of landing in one piece at the end.
 *
 * Deliberately built from the real page's own measurements — the 25vh backdrop,
 * the 300px sidebar, the 2:3 poster — so the layout does not jump when the
 * content replaces it.
 */
export default function Loading() {
    return (
        <div className="min-h-screen bg-linear-to-b -mt-24">
            <div className="relative h-[25vh] min-h-44 w-full overflow-hidden">
                <div className="h-full w-full animate-pulse bg-linear-to-br from-surface-3 to-surface-2" />
            </div>

            <div className="container relative -top-20 z-10 md:grid md:gap-8 md:grid-cols-[300px_1fr] m-auto pb-20 px-4 md:px-6">
                {/* Mobile header: poster beside the title, as the page has it */}
                <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                    <div className="aspect-2/3 animate-pulse rounded-lg bg-surface-2" />
                    <div className="space-y-2 py-1">
                        <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
                    </div>
                </div>

                {/* Desktop sidebar: poster, then the list controls under it */}
                <div className="hidden md:block space-y-4">
                    <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-surface-2" />
                    <div className="h-11 w-full animate-pulse rounded-lg bg-surface-2" />
                    <div className="h-24 w-full animate-pulse rounded-lg bg-surface-2" />
                </div>

                <div className="space-y-8">
                    <div className="hidden md:block space-y-3">
                        <div className="h-9 w-2/3 animate-pulse rounded bg-surface-2" />
                        <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
                    </div>

                    {/* Section nav */}
                    <div className="flex gap-2">
                        {[64, 56, 72, 60].map((w) => (
                            <div key={w} className="h-9 animate-pulse rounded-lg bg-surface-2" style={{ width: w }} />
                        ))}
                    </div>

                    {/* Synopsis */}
                    <div className="space-y-2">
                        {["100%", "97%", "92%", "60%"].map((w) => (
                            <div key={w} className="h-3 animate-pulse rounded bg-surface-2" style={{ width: w }} />
                        ))}
                    </div>

                    {/* Cast, and the rails that follow it */}
                    {[0, 1].map((row) => (
                        <div key={row} className="space-y-4">
                            <div className="h-5 w-32 animate-pulse rounded bg-surface-2" />
                            <div className="flex gap-4 overflow-hidden">
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="w-24 shrink-0 space-y-2">
                                        <div className="aspect-2/3 animate-pulse rounded-lg bg-surface-2" />
                                        <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
