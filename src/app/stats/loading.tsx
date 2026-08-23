/** Figures first — bare, as the dashboard has them — then the charts. */
import { Line, Block, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10 space-y-14">
            {/* "Hero numbers — bare figures, no cards", as the dashboard puts it.
                Boxing them here would promise a tile that never arrives. */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <Line w={64} h={13} />
                        <Line w={110} h={34} />
                        <Line w={130} h={11} />
                    </div>
                ))}
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
