import { getDashboardStats } from "@/actions/stats";
import { WatchlistStats } from "@/components/watchlist-stats";
import { getCachedWatchlist } from "@/components/watchlist-data";

const MOCK_USER_ID = "mock-user-1";

export async function WatchlistHeaderStats() {
    const watchlist = await getCachedWatchlist();
    const stats = await getDashboardStats(MOCK_USER_ID, watchlist);
    return <WatchlistStats stats={stats} />;
}
