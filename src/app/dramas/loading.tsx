/**
 * Browse: the way back, the heading, then the results beside the filter box.
 *
 * Both result shapes are rendered and CSS keeps one, rather than the server
 * picking the right one: a loading.tsx is a Suspense fallback, so it must not
 * suspend, so it cannot read the preference itself. The layout writes the saved
 * view onto <html> once per document and the switch updates it at click time,
 * which leaves the choice readable from a plain selector here.
 */
import { Line, PosterGrid, MediaRows } from "@/components/skeleton-parts";

// Uneven on purpose, like the category and country names they stand in for.
const CATEGORY_WIDTHS = ["58%", "46%", "64%", "40%", "52%"];

function FilterHeading({ w }: { w: number }) {
    return <Line w={w} h={10} />;
}

export default function Loading() {
    return (
        <div className="container py-6 md:py-10 mx-auto max-w-7xl px-4 relative z-10">
            <div className="mb-6">
                <Line w={110} h={14} />
            </div>
            <div className="mb-8 space-y-2">
                <Line w={220} h={30} />
                <Line w={190} h={14} />
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                <div className="flex-1 min-w-0 w-full">
                    {/* Page count on the left, the view switch on the right */}
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <Line w={130} h={14} />
                        <Line w={64} h={30} />
                    </div>
                    <div className="[[data-dramas-view=list]_&]:hidden">
                        <PosterGrid count={15} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4 md:gap-5" />
                    </div>
                    <div className="hidden [[data-dramas-view=list]_&]:block">
                        <MediaRows count={6} />
                    </div>
                </div>

                {/* The filter box: category, country, then the smaller controls */}
                <div className="w-full lg:w-52 xl:w-75 shrink-0 space-y-5 bg-box p-4 rounded-lg">
                    <div className="space-y-3">
                        <FilterHeading w={64} />
                        {CATEGORY_WIDTHS.map((w, i) => (
                            <div key={i} className="flex items-center gap-2.5 px-3">
                                <div className="size-1.5 shrink-0 rounded-full bg-surface-4" />
                                <Line w={w} h={12} />
                            </div>
                        ))}
                    </div>
                    <div className="h-px bg-surface-2" />
                    <div className="space-y-3">
                        <FilterHeading w={56} />
                        <Line w="100%" h={32} />
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 px-1.5">
                            {Array.from({ length: 10 }, (_, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                    <div className="size-3.5 shrink-0 animate-pulse rounded bg-surface-2" />
                                    <Line w={i % 3 === 0 ? "70%" : "55%"} h={10} />
                                </div>
                            ))}
                        </div>
                    </div>
                    {[48, 44, 36].map((w) => (
                        <div key={w} className="space-y-5">
                            <div className="h-px bg-surface-2" />
                            <div className="space-y-2.5">
                                <FilterHeading w={w} />
                                <Line w="100%" h={30} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
