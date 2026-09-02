/**
 * Browse: a heading, the filter bar, then whichever shape the results are
 * about to take.
 *
 * Both shapes are rendered and CSS keeps one, rather than the server picking
 * the right one: a loading.tsx is a Suspense fallback, so it must not suspend,
 * so it cannot read the preference itself. The layout writes the saved view
 * onto <html> once per document and the switch updates it at click time, which
 * leaves the choice readable from a plain selector here.
 */
import { PageHeading, Pills, PosterGrid, Line } from "@/components/skeleton-parts";

/** The list view's row: poster, then the title, meta, stars and synopsis beside it. */
function DramaRows({ count = 6 }: { count?: number }) {
    return (
        <div className="flex flex-col gap-3">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex gap-3 md:gap-4 rounded-xl border border-line-soft bg-surface-1 p-3 md:p-4">
                    <div className="aspect-2/3 w-20 sm:w-24 md:w-28 shrink-0 animate-pulse rounded-lg bg-surface-2" />
                    <div className="min-w-0 flex-1 space-y-2.5 pt-1">
                        <Line w="38%" h={18} />
                        <Line w="24%" h={12} />
                        <Line w={110} h={14} />
                        <div className="space-y-1.5 pt-1">
                            <Line w="100%" h={10} />
                            <Line w="72%" h={10} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default function Loading() {
    return (
        <div className="container py-6 md:py-10 max-w-[95%] md:max-w-[90%] mx-auto px-2 md:px-0 relative z-10 space-y-6">
            <PageHeading width="30%" />
            <Pills count={6} />
            <div className="[[data-dramas-view=list]_&]:hidden">
                <PosterGrid count={18} />
            </div>
            <div className="hidden [[data-dramas-view=list]_&]:block">
                <DramaRows count={6} />
            </div>
        </div>
    );
}
