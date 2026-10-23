/** The diary: search and the action rail, then each day as a date column beside its entries. */
import { Line, PageHeading } from "@/components/skeleton-parts";

// Uneven on purpose: real rail labels are words of different lengths.
const RAIL_WIDTHS = [44, 58, 52, 50, 46, 40];
const ENTRY_WIDTHS = ["62%", "48%", "70%", "54%", "40%", "58%"];
const DAYS = [4, 3, 5];

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-4xl relative z-10">
            <div className="mb-8">
                <PageHeading width="34%" />
            </div>

            <div className="space-y-6">
                <div className="space-y-2.5">
                    <div className="h-9 w-full animate-pulse rounded-lg bg-surface-2" />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-surface-2 p-0.75">
                            {RAIL_WIDTHS.map((w, i) => (
                                <div key={i} className="flex h-7 items-center px-2.5">
                                    <Line w={w} h={10} />
                                </div>
                            ))}
                        </div>
                        <Line w={150} h={12} />
                    </div>
                </div>

                {DAYS.map((count, day) => (
                    <div key={day} className="grid gap-x-5 gap-y-1 border-t border-line-soft pt-3 md:grid-cols-[110px_1fr]">
                        <div className="space-y-1.5 md:pt-2">
                            <Line w={72} h={14} />
                            <Line w={56} h={10} />
                        </div>
                        <div className="divide-y divide-line-soft min-w-0">
                            {Array.from({ length: count }, (_, i) => (
                                <div key={i} className="flex items-center gap-3 py-2">
                                    <div className="w-10 shrink-0">
                                        <Line w={32} h={10} />
                                    </div>
                                    <div className="h-9.5 w-6.5 shrink-0 animate-pulse rounded bg-surface-2" />
                                    <div className="flex-1 min-w-0">
                                        <Line w={ENTRY_WIDTHS[(day * 2 + i) % ENTRY_WIDTHS.length]} h={12} />
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
