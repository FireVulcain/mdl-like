/** Cast, in the groups MDL files them under. */
import { PageHeading, PosterGrid, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto md:max-w-[80%] space-y-8">
            <PageHeading width="40%" />
            {[0, 1].map((group) => (
                <div key={group} className="space-y-4">
                    <SectionHeading width={130} />
                    <PosterGrid count={12} />
                </div>
            ))}
        </div>
    );
}
