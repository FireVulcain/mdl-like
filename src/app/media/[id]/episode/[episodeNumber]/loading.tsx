/** One episode: its still, beside what is known about it. */
import { Line, Block } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 space-y-8 m-auto max-w-5xl px-4 md:px-6">
            <div className="flex items-center justify-between">
                <Line w={90} h={16} />
                <Line w={150} h={16} />
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
                <Block className="h-48 w-full sm:w-80 shrink-0" />
                <div className="flex-1 space-y-3">
                    <Line w="60%" h={24} />
                    <Line w="35%" h={14} />
                    {["100%", "92%", "70%"].map((w) => <Line key={w} w={w} />)}
                </div>
            </div>
        </div>
    );
}
