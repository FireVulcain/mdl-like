/** Season ratings as a wall of cells, then the episodes as a grid of stills. */
import { Line } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 m-auto max-w-5xl px-4 md:px-6 space-y-8">
            <Line w={70} h={16} />

            <div className="space-y-2">
                <Line w="45%" h={30} />
                <Line w={90} h={14} />
            </div>

            {/* Episode Ratings. The heading carries a source badge beside it, and
                the ratings themselves are a wall of 19x12 cells — the most
                distinctive thing on the page, and the thing a skeleton drawn
                from the CSS shell alone misses entirely. */}
            <div className="space-y-5">
                <div className="flex items-center gap-2">
                    <Line w={165} h={20} />
                    <Line w={58} h={17} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-1.5">
                                <div className="size-2.5 animate-pulse rounded-full bg-surface-2" />
                                <Line w={52} h={11} />
                            </div>
                        ))}
                    </div>
                    <Line w={96} h={30} />
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 8 }, (_, i) => (
                        <div key={i} className="h-12 w-19 animate-pulse rounded-md bg-surface-2" />
                    ))}
                </div>

                <div className="space-y-2.5">
                    <Line w={200} h={17} />
                    <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 16 }, (_, i) => (
                            <div key={i} className="h-12 w-19 animate-pulse rounded-md bg-surface-2" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Season heading, then its tabs pushed to the right */}
            <div className="space-y-5">
                <div className="flex items-center gap-3 flex-wrap">
                    <Line w={110} h={20} />
                    <div className="ml-auto flex gap-1">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-7 w-10 animate-pulse rounded-lg bg-surface-2" />
                        ))}
                    </div>
                </div>

                {/* Episodes are a grid of stills, two or three across — not the
                    list of rows this file used to draw. */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-6">
                    {Array.from({ length: 9 }, (_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="aspect-video w-full animate-pulse rounded-lg bg-surface-2" />
                            <Line w="80%" h={13} />
                            <Line w="45%" h={10} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
