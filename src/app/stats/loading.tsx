/** The page's own shape while it loads: the column of figures and lists on the left, the charts on the right. */
import { Line, Block, PageHeading } from "@/components/skeleton-parts";

// Uneven on purpose, like the genre and country names they stand in for.
const LIST_WIDTHS = ["62%", "48%", "56%", "40%", "52%", "36%"];

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-6xl relative z-10">
            <div className="mb-8">
                <PageHeading width="18%" />
            </div>

            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-[250px_1fr] md:gap-8 md:items-start">
                <div className="space-y-3.5">
                    {/* The figures' box: four numbers, two by two */}
                    <div className="grid grid-cols-2 gap-4 rounded-lg bg-box p-4">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <Line w={64} h={26} />
                                <Line w={48} h={11} />
                            </div>
                        ))}
                    </div>
                    {/* Top genres, by country */}
                    {[0, 1].map((box) => (
                        <div key={box} className="space-y-2.5 rounded-lg bg-box p-4">
                            <Line w={90} h={14} />
                            {LIST_WIDTHS.map((w, i) => (
                                <div key={i} className="flex justify-between gap-3">
                                    <Line w={w} h={12} />
                                    <Line w={20} h={12} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="min-w-0 space-y-10">
                    {/* Activity */}
                    <div className="space-y-4">
                        <Line w={80} h={16} />
                        <Block className="h-32 w-full" />
                    </div>
                    {/* Your ratings, by release year */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
                        {[0, 1].map((chart) => (
                            <div key={chart} className="space-y-4">
                                <Line w={110} h={16} />
                                <Block className="h-36 w-full" />
                            </div>
                        ))}
                    </div>
                    {/* Most seen actors */}
                    <div className="space-y-4">
                        <Line w={130} h={16} />
                        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-5">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex flex-col items-center gap-2">
                                    <div className="h-14 w-14 animate-pulse rounded-full bg-surface-2" />
                                    <Line w={70} h={11} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
