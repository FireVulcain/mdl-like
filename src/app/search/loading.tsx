/** Results: the query heading, then one section of titles. */
import { PageHeading, PosterGrid, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto md:max-w-[80%] space-y-8">
            <PageHeading width="45%" />
            <div className="space-y-4">
                <SectionHeading width={140} />
                <PosterGrid count={12} />
            </div>
        </div>
    );
}
