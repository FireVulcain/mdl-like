/** Stills three across, then posters six — the two runs the gallery holds. */
import { Line, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto">
            <Line w="35%" h={30} />

            <div className="space-y-4">
                <SectionHeading width={120} />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div key={i} className="aspect-video w-full animate-pulse rounded-lg bg-surface-2" />
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeading width={110} />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 12 }, (_, i) => (
                        <div key={i} className="aspect-2/3 w-full animate-pulse rounded-lg bg-surface-2" />
                    ))}
                </div>
            </div>
        </div>
    );
}
