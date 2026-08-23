/** The home page: the hero, then its rails. */
import { Block, PosterRail, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-10 md:py-16 space-y-8 md:space-y-14 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0 relative z-10">
            <Block className="h-64 md:h-80 w-full rounded-2xl" />
            {[0, 1, 2].map((rail) => (
                <div key={rail} className="space-y-4">
                    <SectionHeading width={190} />
                    <PosterRail count={7} />
                </div>
            ))}
        </div>
    );
}
