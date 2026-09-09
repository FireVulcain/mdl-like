/** Results: the query heading, then one section of titles.
 *
 * Same trick as /dramas: a loading.tsx cannot suspend, so it cannot read the
 * saved view itself. Both shapes are rendered and CSS keeps the one named on
 * <html> — written there by the layout on a full load, and by the switch itself
 * in between.
 */
import { PageHeading, PosterGrid, SectionHeading, MediaRows } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto md:max-w-[80%] space-y-8">
            <PageHeading width="45%" />
            <div className="space-y-4">
                <SectionHeading width={140} />
                <div className="[[data-search-view=list]_&]:hidden">
                    <PosterGrid count={12} />
                </div>
                <div className="hidden [[data-search-view=list]_&]:block">
                    <MediaRows count={5} />
                </div>
            </div>
        </div>
    );
}
