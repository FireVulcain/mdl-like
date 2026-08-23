/** A feed of events: narrow measure, no artwork. */
import { PageHeading, Pills, RowList } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-4xl relative z-10 space-y-6">
            <PageHeading width="34%" />
            <Pills count={5} />
            <RowList count={12} />
        </div>
    );
}
