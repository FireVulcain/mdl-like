/** A public profile: who it is, their podium, then the same rows the watchlist uses. */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-10 m-auto max-w-[80%] relative z-10 space-y-8">
            <div className="space-y-3">
                <Line w={280} h={30} />
                <Line w={190} h={14} />
            </div>

            {/* The podium, three places wide */}
            <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-surface-2" />
                        <Line w="80%" />
                    </div>
                ))}
            </div>

            {/* This page renders the watchlist table, so it waits as rows */}
            <div className="space-y-2">
                {Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-1 p-2">
                        <div className="h-20 w-14 shrink-0 animate-pulse rounded-lg bg-surface-2" />
                        <div className="min-w-0 flex-1 space-y-2">
                            <Line w="45%" h={15} />
                            <Line w="28%" h={11} />
                        </div>
                        <Block className="hidden sm:block h-3 w-14" />
                    </div>
                ))}
            </div>
        </div>
    );
}
