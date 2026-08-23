/** A public profile: who it is, then what they watch. */
import { Line, Block, PosterGrid } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-10 m-auto max-w-[80%] relative z-10 space-y-8">
            <div className="flex items-center gap-4">
                <Block className="size-16 rounded-full" />
                <div className="space-y-2">
                    <Line w={200} h={24} />
                    <Line w={130} h={13} />
                </div>
            </div>
            <PosterGrid count={12} />
        </div>
    );
}
