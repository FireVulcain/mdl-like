/** A gallery: wider cells than a poster grid. */
import { PageHeading, PosterGrid } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto px-4">
            <PageHeading width="34%" />
            <PosterGrid count={18} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" />
        </div>
    );
}
