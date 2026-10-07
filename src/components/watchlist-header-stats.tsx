import { type DashboardStats } from "@/types/stats";
import { WatchlistStats } from "@/components/watchlist-stats";

interface WatchlistHeaderStatsProps {
    stats: Pick<DashboardStats, "watchTimeMinutes" | "completionRate" | "avgScore">;
}

export function WatchlistHeaderStats({ stats }: WatchlistHeaderStatsProps) {
    return <WatchlistStats stats={stats} />;
}
