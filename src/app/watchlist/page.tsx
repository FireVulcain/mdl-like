import { getWatchlist } from "@/actions/media";
import { getDashboardStats } from "@/actions/stats";
import { WatchlistTable } from "@/components/watchlist-table";
import { WatchlistStats } from "@/components/watchlist-stats";

const MOCK_USER_ID = "mock-user-1";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WatchlistPage() {
    let watchlist: Awaited<ReturnType<typeof getWatchlist>> = [];
    let stats = null;

    try {
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            [watchlist, stats] = await Promise.all([
                getWatchlist(MOCK_USER_ID),
                getDashboardStats(MOCK_USER_ID)
            ]);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }

    const watchingCount = watchlist.filter(i => i.status === "Watching").length;
    const completedCount = watchlist.filter(i => i.totalEp && i.progress >= i.totalEp).length;

    return (
        <div className="container py-8 space-y-6 m-auto max-w-[80%]">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
                    <p className="text-muted-foreground mt-1">
                        {watchlist.length} titles · {watchingCount} watching · {completedCount} completed
                    </p>
                </div>

                {stats && <WatchlistStats stats={stats} items={watchlist} />}
            </div>

            <WatchlistTable items={watchlist} />
        </div>
    );
}
