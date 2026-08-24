/** Cast, in the groups MDL files them under. */
import { Line, PosterGrid, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-6 m-auto px-4 md:px-6">
            <div className="space-y-2">
                <Line w="45%" h={30} />
                <Line w={120} h={14} />
            </div>
            {[0, 1].map((group) => (
                <div key={group} className="space-y-4">
                    <SectionHeading width={130} />
                    <PosterGrid count={12} />
                </div>
            ))}
        </div>
    );
}
