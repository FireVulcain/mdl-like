/**
 * The co-star lookup: the heading, the two portrait slots either side of an
 * ampersand, then the rows they share.
 *
 * Without this the route fell through to the root skeleton — the home page's
 * hero and rails — which is the wrong shape by a long way. Built on the page's
 * own measurements: the 112px portraits, the 80/96px 2:3 poster, the two role
 * lines side by side, so nothing shifts when the content lands.
 *
 * Always draws rows. The page may open with nothing chosen yet, but a pair
 * arriving from a person page or a shared link is the common case, and a
 * flash of rows under two empty slots is cheaper than a page that only ever
 * loads into a blank.
 */
import { Block, Line, PageHeading, SectionHeading } from "@/components/skeleton-parts";

function Slot() {
    return (
        <div className="flex flex-col items-center gap-3 py-2">
            <div className="h-28 w-28 animate-pulse rounded-full bg-surface-2" />
            <Line w={140} h={20} />
        </div>
    );
}

function Role() {
    return (
        <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-surface-2" />
            <div className="space-y-1.5">
                <Line w={90} h={10} />
                <Line w={130} h={12} />
            </div>
        </div>
    );
}

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto px-4 md:px-6 max-w-4xl">
            <Line w={110} h={20} />
            <PageHeading width="30%" />

            <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                <Slot />
                <span className="hidden text-center font-display text-2xl text-fg-faint md:block">&amp;</span>
                <Slot />
            </div>

            <div className="space-y-4">
                <SectionHeading width={160} />
                <div className="flex flex-col gap-3">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex gap-3 rounded-xl border border-line-soft bg-surface-1 p-3 md:gap-4 md:p-4">
                            <Block className="aspect-2/3 w-20 shrink-0 sm:w-24" />
                            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                                <Line w="45%" h={18} />
                                <Line w="30%" h={12} />
                                <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
                                    <Role />
                                    <Role />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
