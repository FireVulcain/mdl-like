/** Another member's list: the name, the figures as a sentence, the toolbar panel, then the archive rows grouped by status. */
import { Line, Block, PageHeading } from "@/components/skeleton-parts";

// Uneven on purpose, like the titles they stand in for.
const TITLE_WIDTHS = ["42%", "30%", "52%", "36%", "46%", "28%", "40%"];
const GROUPS = [7, 5];

export default function Loading() {
    return (
        <div className="container py-8 px-4 m-auto max-w-6xl relative z-10 space-y-6">
            <PageHeading width="30%" />

            <div className="space-y-6">
                <Line w={300} h={14} />
                <Block className="h-14 w-full" />

                <div className="-mx-3">
                    {GROUPS.map((count, group) => (
                        <div key={group}>
                            <div className={`flex items-center gap-3 px-3 pb-2 ${group === 0 ? "" : "pt-8"}`}>
                                <Line w={group === 0 ? 90 : 120} h={20} />
                                <div className="flex-1 h-px bg-surface-3" />
                            </div>
                            {Array.from({ length: count }, (_, i) => (
                                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                                    <div className="size-1.5 shrink-0 rounded-full bg-surface-4" />
                                    <div className="h-10 w-7 shrink-0 animate-pulse rounded bg-surface-2" />
                                    <div className="min-w-0 flex-1">
                                        <Line w={TITLE_WIDTHS[(group * 3 + i) % TITLE_WIDTHS.length]} h={13} />
                                    </div>
                                    <div className="flex w-20 shrink-0 justify-end">
                                        <Line w={36} h={11} />
                                    </div>
                                    <div className="flex w-14 shrink-0 justify-end">
                                        <Line w={28} h={11} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
