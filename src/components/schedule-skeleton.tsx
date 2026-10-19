/**
 * The calendar's loading state, drawn the way the page draws it: the month as
 * the title, the timeline's rows, the day panel beside them.
 *
 * Shared by the route's loading.tsx and the page's own Suspense fallback so the
 * two cannot drift apart again. The title is a shape rather than text: the
 * month is not known until the data arrives, and printing the wrong word only
 * to replace it is worse than printing nothing.
 */
export function ScheduleSkeleton() {
    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-352">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="animate-pulse">
                        <div className="h-8 w-52 rounded bg-surface-4" />
                        <div className="h-4 w-40 mt-2 rounded bg-surface-3" />
                    </div>
                    <div className="flex items-center gap-2 animate-pulse">
                        <div className="h-9 w-9 rounded-lg bg-surface-2" />
                        <div className="h-5 w-12 rounded bg-surface-2" />
                        <div className="h-9 w-20 rounded-lg bg-surface-2" />
                    </div>
                </div>

                <div className="flex flex-wrap items-start gap-6 animate-pulse">
                    <div className="min-w-0 flex-[999_1_760px] rounded-lg border border-line-strong overflow-hidden">
                        <div className="h-12 bg-surface-2 border-b border-line-strong" />
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-3 py-1.5 border-t border-line-soft first:border-t-0">
                                <div className="h-7.5 w-5 rounded-sm bg-surface-3" />
                                <div className="h-3.5 rounded bg-surface-3" style={{ width: `${80 + ((i * 37) % 60)}px` }} />
                            </div>
                        ))}
                    </div>
                    <div className="h-80 min-w-0 flex-[1_1_280px] rounded-lg bg-box lg:max-w-80" />
                </div>
            </div>
        </div>
    );
}
