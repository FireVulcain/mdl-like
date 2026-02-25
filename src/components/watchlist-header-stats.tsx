import { getDashboardStats } from "@/actions/stats";
import { WatchlistStats } from "@/components/watchlist-stats";
import { getCachedWatchlist } from "@/components/watchlist-data";

export async function WatchlistHeaderStats() {
    const watchlist = await getCachedWatchlist();
    const stats = await getDashboardStats(watchlist);
    return <WatchlistStats stats={stats} />;
}
