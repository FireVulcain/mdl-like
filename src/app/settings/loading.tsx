/** One page of groups: the contents list on the left, then each group's heading over a box of setting rows. */
import { Line, PageHeading } from "@/components/skeleton-parts";

// Uneven on purpose, like the group names and labels they stand in for.
const INDEX_WIDTHS = [52, 70, 120, 74, 46, 40];
const GROUPS = [
    { title: 64, rows: [["34%", "rail"], ["46%", "switch"], ["38%", "chips"], ["30%", "switch"]] },
    { title: 84, rows: [["28%", "list"], ["26%", "chips"]] },
    { title: 150, rows: [["36%", "rail"], ["32%", "select"], ["40%", "rail"]] },
] as const;

function Control({ kind }: { kind: string }) {
    if (kind === "switch") return <div className="h-5 w-8.5 shrink-0 animate-pulse rounded-full bg-surface-2" />;
    if (kind === "select") return <div className="h-8 w-60 shrink-0 animate-pulse rounded-md bg-surface-2" />;
    return <div className="h-8.5 w-48 shrink-0 animate-pulse rounded-lg bg-surface-2" />;
}

export default function Loading() {
    return (
        <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10">
            <div className="mb-8">
                <PageHeading width="24%" />
            </div>

            <div className="md:grid md:grid-cols-[170px_minmax(0,1fr)] md:gap-10 md:items-start">
                <div className="hidden md:grid gap-3 border-l border-line py-1 pl-3.5">
                    {INDEX_WIDTHS.map((w, i) => (
                        <Line key={i} w={w} h={11} />
                    ))}
                </div>

                <div className="space-y-10 min-w-0">
                    {GROUPS.map((g, gi) => (
                        <div key={gi}>
                            <div className="mb-3 space-y-2">
                                <Line w={g.title} h={17} />
                                <Line w="48%" h={11} />
                            </div>
                            <div className="rounded-lg bg-box px-4.5 divide-y divide-line-soft">
                                {g.rows.map(([w, kind], i) => {
                                    const wide = kind === "list" || kind === "chips";
                                    return (
                                        <div key={i} className={wide ? "space-y-3 py-4" : "flex items-center justify-between gap-6 py-4"}>
                                            <div className="flex-1 space-y-2">
                                                <Line w={w} h={13} />
                                                <Line w="62%" h={10} />
                                            </div>
                                            {wide ? (
                                                <div className="flex gap-2">
                                                    {[72, 96, 64].map((cw) => (
                                                        <div key={cw} className="h-7 animate-pulse rounded-md bg-surface-2" style={{ width: cw }} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <Control kind={kind} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
