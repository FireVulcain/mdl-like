/** Reviews in a narrow column: who wrote it, then what they wrote. */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto max-w-3xl px-4">
            <Line w="45%" h={30} />
            {[0, 1, 2].map((review) => (
                <div key={review} className="space-y-3 py-4">
                    <div className="flex items-center gap-3">
                        <Block className="size-9 rounded-full" />
                        <div className="space-y-1.5">
                            <Line w={140} h={13} />
                            <Line w={90} h={10} />
                        </div>
                    </div>
                    {["100%", "97%", "90%", "55%"].map((w) => <Line key={w} w={w} />)}
                </div>
            ))}
        </div>
    );
}
