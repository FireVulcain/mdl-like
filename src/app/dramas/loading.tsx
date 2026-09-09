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
import { PageHeading, Pills, PosterGrid, MediaRows } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-6 md:py-10 max-w-[95%] md:max-w-[90%] mx-auto px-2 md:px-0 relative z-10 space-y-6">
            <PageHeading width="30%" />
            <Pills count={6} />
            <div className="[[data-dramas-view=list]_&]:hidden">
                <PosterGrid count={18} />
            </div>
            <div className="hidden [[data-dramas-view=list]_&]:block">
                <MediaRows count={6} />
            </div>
        </div>
    );
}
