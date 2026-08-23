/** Reviews: who wrote it, then what they wrote. */
import { Line, Block, PageHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto md:max-w-[80%] space-y-6">
            <PageHeading width="38%" />
            {[0, 1, 2].map((review) => (
                <div key={review} className="space-y-3 py-4">
                    <div className="flex items-center gap-3">
                        <Block className="size-9 rounded-full" />
                        <Line w={140} h={14} />
                    </div>
                    {["100%", "97%", "90%", "55%"].map((w) => <Line key={w} w={w} />)}
                </div>
            ))}
        </div>
    );
}
