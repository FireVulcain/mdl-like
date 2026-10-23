/**
 * The home page's waiting shapes. Shared by the page's own Suspense fallbacks
 * and by app/loading.tsx, so navigating to the home page shows one hero, not a
 * boxed placeholder that then swaps for the full-bleed one.
 */

export function HeroSkeleton() {
    return (
        <div className="relative h-[90vh] min-h-125 -mt-24 w-full overflow-hidden bg-linear-to-b from-panel to-page animate-pulse">
            <div className="absolute inset-0 bg-linear-to-r from-page via-page/80 to-transparent" />
            <div className="relative h-full flex">
                <div className="flex-1 flex flex-col justify-end pb-16 md:pb-24 pl-[5%] md:pl-[7.5%] space-y-4 md:space-y-6 max-w-xl">
                    {/* Mirrors the real hero: title, hairline progress, one button
                        and a text link. It has to be redrawn whenever that block
                        changes, or the page flashes a layout that no longer
                        exists. */}
                    <div className="space-y-3">
                        <div className="h-12 md:h-16 w-3/4 rounded-xl bg-surface-4" />
                        <div className="h-12 md:h-16 w-1/2 rounded-xl bg-surface-4" />
                    </div>
                    <div className="space-y-2.5">
                        <div className="h-0.5 w-64 md:w-80 rounded-full bg-surface-4" />
                        <div className="h-4 w-44 rounded bg-surface-4" />
                    </div>
                    <div className="flex items-center gap-6 pt-2">
                        <div className="h-10 w-32 rounded-lg bg-surface-4" />
                        <div className="h-4 w-20 rounded bg-surface-4" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function KDramaSkeleton() {
    return (
        <section className="relative space-y-6 md:space-y-10 animate-pulse">
            <div className="space-y-3">
                <div className="h-3 w-40 rounded bg-surface-3" />
                <div className="h-9 w-72 rounded-lg bg-surface-4" />
                <div className="h-3 w-56 rounded bg-surface-2" />
                <div className="h-px w-full bg-surface-3" />
            </div>
            <div className="space-y-8">
                {[0, 1].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="h-4 w-40 rounded bg-surface-3" />
                        <div className="flex gap-4 overflow-hidden">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="w-32 sm:w-40 md:w-55 shrink-0 aspect-2/3 rounded-xl bg-surface-2" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
