/** The collection: title beside its figures, the toolbar panel, then the rows. */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-6 m-auto md:max-w-[80%] relative z-10 space-y-4 px-4">
            {/* Title on the left, the run of figures on the right — the header
                is one row, not a heading with a subtitle under it. */}
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="space-y-2">
                    <Line w={240} h={30} />
                    <Line w={170} h={14} />
                </div>
                <div className="hidden md:flex items-baseline gap-8">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="space-y-1.5">
                            <Line w={40} h={20} />
                            <Line w={56} h={10} />
                        </div>
                    ))}
                </div>
            </div>

            {/* The controls live in one glass panel, as they do on the page */}
            <Block className="h-14 w-full" />

            {/* Rows, not cards in a grid: a thumbnail, then the title and its
                progress. Sized to the real 20x14 poster thumbnail so the list
                does not resize when it fills. */}
            <div className="space-y-2">
                {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-white/3 p-2">
                        <div className="h-20 w-14 shrink-0 animate-pulse rounded-lg bg-white/5" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Line w="45%" h={15} />
                            <Line w="28%" h={11} />
                            <Line w="60%" h={8} />
                        </div>
                        <div className="hidden sm:flex items-center gap-6 pr-2">
                            <Line w={54} h={11} />
                            <Line w={34} h={11} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
