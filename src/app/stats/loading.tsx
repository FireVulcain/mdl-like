/** Figures first, then the charts that break them down. */
import { Block, PageHeading, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10 space-y-8">
            <PageHeading width="26%" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => <Block key={i} className="h-24" />)}
            </div>
            {[0, 1].map((chart) => (
                <div key={chart} className="space-y-4">
                    <SectionHeading width={160} />
                    <Block className="h-64 w-full" />
                </div>
            ))}
        </div>
    );
}
