import { getWatchlist } from "@/actions/media";
import { getDashboardStats } from "@/actions/stats";
import { EMPTY_STATS } from "@/types/stats";
import { WatchlistStats } from "@/components/watchlist-stats";
import { WatchlistTable } from "@/components/watchlist-table";

const MOCK_USER_ID = "mock-user-1";

export async function WatchlistData() {
    let watchlist: Awaited<ReturnType<typeof getWatchlist>> = [];
    let stats = EMPTY_STATS;

    try {
        watchlist = await getWatchlist(MOCK_USER_ID);
        stats = await getDashboardStats(MOCK_USER_ID, watchlist);
    } catch (error) {
        console.error("Error fetching watchlist data:", error);
    }

    const watchingCount = watchlist.filter((i) => i.status === "Watching").length;
    const completedCount = watchlist.filter((i) => i.totalEp && i.progress >= i.totalEp).length;

    return (
        <>
            <div className="flex items-center justify-between">
                <p className="text-muted-foreground">
                    {watchlist.length} titles · {watchingCount} watching · {completedCount} completed
                </p>
                <WatchlistStats stats={stats} />
            </div>
            <WatchlistTable items={watchlist} />
        </>
    );
}
