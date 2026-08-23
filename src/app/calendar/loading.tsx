/** The schedule: a heading per day, and what airs under it. */
import { Line, PageHeading, Pills, PosterRail } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
            <PageHeading width="32%" />
            <Pills count={3} />
            <div className="space-y-6">
                {[0, 1, 2].map((day) => (
                    <div key={day} className="space-y-3">
                        <Line w={200} h={18} />
                        <PosterRail count={5} />
                    </div>
                ))}
            </div>
        </div>
    );
}
