import { getActivityLog, backfillActivityLog } from "@/actions/history";
import { HistoryFeed } from "@/components/history-feed";
import { PageBackground } from "@/components/page-background";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage() {
    let initialData = { items: [] as Awaited<ReturnType<typeof getActivityLog>>["items"], nextCursor: null as string | null };

    try {
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            const data = await getActivityLog();
            if (data.items.length === 0) {
                // Auto-backfill on first visit
                await backfillActivityLog();
                const backfilled = await getActivityLog();
                initialData = backfilled;
            } else {
                initialData = data;
            }
        }
    } catch (error) {
        console.error("Error fetching activity history:", error);
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <PageBackground />

            <div className="container py-8 px-4 mx-auto max-w-4xl relative z-10">
                <div className="mb-8">
                    <h1 className="font-display text-3xl font-semibold tracking-tight">Activity History</h1>
                    <p className="text-muted-foreground mt-1">A log of every action tracked on your watchlist</p>
                </div>
                <HistoryFeed initialItems={initialData.items} initialNextCursor={initialData.nextCursor} />
            </div>
        </div>
    );
}
