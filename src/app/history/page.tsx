import { getActivityLog, backfillActivityLog } from "@/actions/history";
import { HistoryFeed } from "@/components/history-feed";

const MOCK_USER_ID = "mock-user-1";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage() {
    let initialData = { items: [] as Awaited<ReturnType<typeof getActivityLog>>["items"], nextCursor: null as string | null };

    try {
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            const data = await getActivityLog(MOCK_USER_ID);
            if (data.items.length === 0) {
                // Auto-backfill on first visit
                await backfillActivityLog(MOCK_USER_ID);
                const backfilled = await getActivityLog(MOCK_USER_ID);
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
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/12 rounded-full blur-[180px]" />
            </div>

            <div className="container py-8 px-4 mx-auto max-w-4xl relative z-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">Activity History</h1>
                    <p className="text-muted-foreground mt-1">A log of every action tracked on your watchlist</p>
                </div>
                <HistoryFeed initialItems={initialData.items} initialNextCursor={initialData.nextCursor} userId={MOCK_USER_ID} />
            </div>
        </div>
    );
}
