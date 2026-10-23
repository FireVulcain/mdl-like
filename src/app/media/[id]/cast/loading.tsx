/** Cast, in the groups MDL files them under: a small portrait beside each name, as CastGallery lays them out. */
import { Line } from "@/components/skeleton-parts";

// Main roles, then the supporting cast: the two groups most pages open with.
const GROUPS = [4, 12];

export default function Loading() {
    return (
        <div className="container py-8 space-y-6 m-auto px-4 md:px-6">
            <div className="space-y-4">
                <Line w={160} h={14} />
                <div className="space-y-2.5">
                    <Line w={230} h={30} />
                    <Line w={260} h={14} />
                </div>
            </div>

            <div className="h-px bg-linear-to-r from-transparent via-line-strong to-transparent" />

            <div className="space-y-8">
                {GROUPS.map((count, group) => (
                    <div key={group} className="space-y-2">
                        <Line w={group === 0 ? 110 : 150} h={20} />
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
                            {Array.from({ length: count }, (_, i) => (
                                <div key={i} className="-mx-2 flex items-center gap-4 p-2">
                                    <div className="h-30 w-22.5 shrink-0 animate-pulse rounded-md bg-surface-2" />
                                    <div className="flex-1 space-y-2">
                                        <Line w={i % 2 ? "70%" : "58%"} h={14} />
                                        <Line w={i % 3 ? "50%" : "62%"} h={12} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
