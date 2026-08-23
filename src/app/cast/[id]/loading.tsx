/** The TMDB person page, in the shape of its MDL counterpart. */
import { Line, Block, PageHeading, PosterGrid, SectionHeading } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 m-auto px-4 md:px-6">
            <div className="md:grid md:gap-8 md:grid-cols-[280px_1fr]">
                <div className="hidden md:block space-y-4">
                    <div className="aspect-2/3 w-full animate-pulse rounded-xl bg-white/5" />
                    <Block className="h-32 w-full" />
                </div>
                <div className="space-y-6">
                    <PageHeading width="45%" />
                    <div className="space-y-2">
                        {["100%", "94%", "60%"].map((w) => <Line key={w} w={w} />)}
                    </div>
                    <SectionHeading width={150} />
                    <PosterGrid count={12} />
                </div>
            </div>
        </div>
    );
}
