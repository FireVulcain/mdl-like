/**
 * The pieces every loading state is built from.
 *
 * Shared so that waiting looks the same everywhere, and so a skeleton is cheap
 * enough to write that a route is never left without one. Each page still
 * composes its own shape from these — a grid page and a list page should not
 * wait in the same posture.
 *
 * One tone throughout, white/5, the fill the app already uses for a resting
 * control. A skeleton that shimmers in three greys draws more attention than
 * the content it stands in for.
 */

export function Line({ w = "100%", h = 12 }: { w?: string | number; h?: number }) {
    return <div className="animate-pulse rounded bg-surface-2" style={{ width: w, height: h }} />;
}

export function Block({ className = "" }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}

/** Title and subtitle, the header nearly every page opens with. */
export function PageHeading({ width = "40%" }: { width?: string }) {
    return (
        <div className="space-y-3">
            <Line w={width} h={30} />
            <Line w="22%" h={14} />
        </div>
    );
}

/** A row of filter pills, the app's standard control bar. */
export function Pills({ count = 4 }: { count?: number }) {
    // Uneven on purpose: real filters are words of different lengths, and a row
    // of identical boxes reads as a placeholder rather than as pills.
    const widths = [72, 96, 64, 88, 110, 76];
    return (
        <div className="flex flex-wrap gap-2">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-2" style={{ width: widths[i % widths.length] }} />
            ))}
        </div>
    );
}

/** One poster card: artwork, title, and the line under it. */
export function PosterCard() {
    return (
        <div className="space-y-2">
            <div className="aspect-2/3 w-full animate-pulse rounded-lg bg-surface-2" />
            <Line w="85%" />
            <Line w="50%" h={10} />
        </div>
    );
}

/** The poster grid the app uses for every collection of titles. */
export function PosterGrid({ count = 12, className = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" }: {
    count?: number;
    className?: string;
}) {
    return (
        <div className={className}>
            {Array.from({ length: count }, (_, i) => <PosterCard key={i} />)}
        </div>
    );
}

/** A horizontal rail, as the home page and the media page use. */
export function PosterRail({ count = 6 }: { count?: number }) {
    return (
        <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="w-32 shrink-0">
                    <PosterCard />
                </div>
            ))}
        </div>
    );
}

/** Stacked rows, for the lists that carry no artwork. */
export function RowList({ count = 10 }: { count?: number }) {
    return (
        <div className="space-y-px">
            {Array.from({ length: count }, (_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                    <Line w="45%" />
                    <div className="flex-1" />
                    <Line w={72} h={10} />
                    <Line w={40} h={10} />
                </div>
            ))}
        </div>
    );
}

/** A section heading with the hairline the app runs beside it. */
export function SectionHeading({ width = 180 }: { width?: number }) {
    return (
        <div className="flex items-center gap-3">
            <Line w={width} h={20} />
            <div className="h-px flex-1 bg-surface-3" />
        </div>
    );
}
