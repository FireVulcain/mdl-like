/** Tabs, then the rows of the panel they open. */
import { Block, PageHeading, Pills } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10 space-y-6">
            <PageHeading width="24%" />
            <Pills count={6} />
            <div className="space-y-4">
                {[0, 1, 2, 3].map((i) => <Block key={i} className="h-20 w-full" />)}
            </div>
        </div>
    );
}
