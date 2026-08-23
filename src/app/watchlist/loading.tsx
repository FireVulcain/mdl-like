/** The collection: heading, the toolbar panel, then the grid. */
import { Block, PageHeading, PosterGrid } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-6 m-auto md:max-w-[80%] relative z-10 space-y-4 px-4">
            <PageHeading width="28%" />
            {/* One panel, as the real toolbar is, not a row of loose pills */}
            <Block className="h-14 w-full" />
            <PosterGrid count={18} />
        </div>
    );
}
