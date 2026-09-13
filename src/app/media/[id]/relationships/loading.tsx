/** The relationship page: the heading, then the chart's frame with the blocks it is about to fill. */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-6 m-auto px-4 md:px-6">
            <Line w={110} h={20} />
            <div className="space-y-3">
                <Line w="30%" h={30} />
                <Line w="22%" h={14} />
            </div>
            <div className="h-px bg-surface-3" />
            <div className="overflow-hidden rounded-xl border border-line-soft bg-surface-1">
                <div className="relative h-[520px] w-full md:h-[760px]">
                    {/* the two leads, middle; four households around them */}
                    <Block className="absolute left-1/2 top-1/2 size-14 -translate-x-[120px] -translate-y-1/2 rounded-full" />
                    <Block className="absolute left-1/2 top-1/2 size-14 translate-x-[64px] -translate-y-1/2 rounded-full" />
                    {[
                        "left-[12%] top-[10%]",
                        "right-[12%] top-[10%]",
                        "left-[12%] bottom-[10%]",
                        "right-[12%] bottom-[10%]",
                    ].map((pos) => (
                        <div key={pos} className={`absolute ${pos} flex gap-8 rounded-2xl border border-dashed border-line-soft p-5`}>
                            <Block className="size-14 rounded-full" />
                            <Block className="size-14 rounded-full" />
                            <Block className="hidden size-14 rounded-full md:block" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
