/** Every episode of a season, as rows. */
import { PageHeading, Pills, RowList } from "@/components/skeleton-parts";

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto md:max-w-[80%] space-y-6">
            <PageHeading width="42%" />
            <Pills count={4} />
            <RowList count={14} />
        </div>
    );
}
