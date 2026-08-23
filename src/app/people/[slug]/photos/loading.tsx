/** Square photo cells, six across as the grid has them. */
import { PageHeading, PosterGrid } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto px-4">
            <PageHeading width="30%" />
            <PosterGrid count={24} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3" />
        </div>
    );
}
