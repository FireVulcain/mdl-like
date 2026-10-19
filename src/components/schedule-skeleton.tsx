/**
 * The schedule's loading state, drawn the way the page draws it: the title,
 * the strip of day chips, then a day of posters.
 *
 * Shared by the route's loading.tsx and the page's own Suspense fallback so the
 * two cannot drift apart. The title is a shape rather than text: the counts are
 * not known until the data arrives.
 */
export function ScheduleSkeleton() {
    return (
        <div className="min-h-screen">
            <div className="container mx-auto max-w-6xl space-y-5 px-4 py-8 animate-pulse">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="h-8 w-40 rounded bg-surface-4" />
                        <div className="mt-2 h-4 w-56 rounded bg-surface-3" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-lg bg-surface-2" />
                        <div className="h-9 w-16 rounded-lg bg-surface-2" />
                    </div>
                </div>
                <div className="flex gap-1.5 overflow-hidden border-b border-line py-2">
                    {Array.from({ length: 14 }).map((_, i) => (
                        <div key={i} className="h-16 w-14.5 shrink-0 rounded-lg bg-surface-1" />
                    ))}
                </div>
                <div className="pt-7">
                    <div className="h-3.5 w-32 rounded bg-surface-3" />
                    <div className="mt-2 h-7 w-36 rounded bg-surface-4" />
                    <div className="mt-3.5 grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3.5 gap-y-4.5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col gap-1.5">
                                <div className="aspect-2/3 rounded-lg bg-surface-3" />
                                <div className="h-3.5 w-3/4 rounded bg-surface-3" />
                                <div className="h-3 w-1/2 rounded bg-surface-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
