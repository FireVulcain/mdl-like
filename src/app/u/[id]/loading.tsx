/** A public profile: who it is and the figures on the left; the podium, the activity and the list on the right. */
import { Line, Block } from "@/components/skeleton-parts";

// Uneven on purpose, like the statuses and titles they stand in for.
const STATUS_WIDTHS = [64, 52, 70, 46, 58];
const ACTIVITY_WIDTHS = ["58%", "44%", "66%", "50%", "38%"];

export default function Loading() {
    return (
        <div className="container py-10 px-4 m-auto max-w-7xl relative z-10 space-y-8 md:space-y-0 md:grid md:grid-cols-[260px_1fr] md:gap-8 md:items-start">
            <aside className="space-y-4">
                {/* The initial and the name: side by side on a phone, stacked beside the page */}
                <div className="flex items-center gap-3 md:flex-col md:items-start">
                    <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-surface-2" />
                    <Line w={150} h={28} />
                </div>

                {/* The figures' box: four numbers two by two, then the status counts */}
                <div className="rounded-lg bg-box p-4 flex flex-col gap-3.5">
                    <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-line-soft">
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1.5">
                                <Line w={48} h={24} />
                                <Line w={44} h={10} />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-2.5">
                        {STATUS_WIDTHS.map((w, i) => (
                            <div key={i} className="contents">
                                <Line w={w} h={11} />
                                <Line w={22} h={11} />
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <div className="space-y-8 min-w-0">
                {/* Top 3: the lead card, #2 and #3 stacked beside it */}
                <div className="space-y-4">
                    <Line w={56} h={20} />
                    <Block className="h-8 w-56" />
                    <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
                        <div className="flex h-56 gap-4 rounded-lg bg-box p-3.5">
                            <div className="h-full aspect-2/3 shrink-0 animate-pulse rounded-md bg-surface-2" />
                            <div className="flex flex-1 flex-col justify-end gap-2">
                                <Line w={10} h={12} />
                                <Line w="70%" h={20} />
                                <Line w={40} h={12} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-3">
                            {[0, 1].map((i) => (
                                <div key={i} className="flex h-28 md:h-auto md:flex-1 items-center gap-3 rounded-lg bg-box p-3">
                                    <div className="h-full aspect-2/3 shrink-0 animate-pulse rounded bg-surface-2" />
                                    <div className="flex-1 space-y-1.5">
                                        <Line w={10} h={12} />
                                        <Line w="65%" h={14} />
                                        <Line w={36} h={10} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Recent activity: a thumbnail, the line, the time */}
                <div>
                    <div className="mb-2">
                        <Line w={130} h={20} />
                    </div>
                    <div className="divide-y divide-line-soft">
                        {ACTIVITY_WIDTHS.map((w, i) => (
                            <div key={i} className="flex items-center gap-3 py-2">
                                <div className="h-9.5 w-6.5 shrink-0 animate-pulse rounded bg-surface-2" />
                                <div className="flex-1">
                                    <Line w={w} h={12} />
                                </div>
                                <Line w={44} h={11} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* The watchlist: its toolbar, then the same rows the watchlist page waits as */}
                <div className="space-y-3">
                    <Line w={96} h={20} />
                    <Block className="h-14 w-full" />
                    <div className="space-y-2">
                        {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-1 p-2">
                                <div className="h-20 w-14 shrink-0 animate-pulse rounded-lg bg-surface-2" />
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
            </div>
        </div>
    );
}
