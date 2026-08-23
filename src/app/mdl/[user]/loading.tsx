/** Another member's list: figures, the toolbar panel, then rows. */
import { Line, Block, PageHeading, RowList } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto max-w-6xl relative z-10 space-y-6">
            <PageHeading width="30%" />
            <Line w="45%" h={14} />
            <Block className="h-14 w-full" />
            <RowList count={14} />
        </div>
    );
}
