/** Browse: a heading, the filter bar, then the grid that fills the page. */
import { PageHeading, Pills, PosterGrid } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-6 md:py-10 max-w-[95%] md:max-w-[90%] mx-auto px-2 md:px-0 relative z-10 space-y-6">
            <PageHeading width="30%" />
            <Pills count={6} />
            <PosterGrid count={18} />
        </div>
    );
}
