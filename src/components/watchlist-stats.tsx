import { type DashboardStats } from "@/types/stats";
import { Clock, Target, Star } from "lucide-react";

interface WatchlistStatsProps {
    stats: DashboardStats;
}

export function WatchlistStats({ stats }: WatchlistStatsProps) {
    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const avgScore =
        stats.ratingDistribution.length > 0
            ? (
                  stats.ratingDistribution.reduce((sum, r) => sum + r.rating * r.count, 0) /
                  stats.ratingDistribution.reduce((sum, r) => sum + r.count, 0)
              ).toFixed(1)
            : "0.0";

    return (
        <div className="flex flex-wrap gap-2 watchlist-stats">
            {/* Watch Time */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-4 py-3 transition-all hover:border-blue-500/20 hover:bg-blue-500/2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/15 transition-colors">
                        <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white tabular-nums">{watchTimeHours}h</div>
                        <div className="text-xs text-gray-500">Total Watched</div>
                    </div>
                </div>
            </div>

            {/* Completion Rate */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-4 py-3 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors">
                        <Target className="h-4.5 w-4.5" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white tabular-nums">{Math.round(stats.completionRate)}%</div>
                        <div className="text-xs text-gray-500">Completion</div>
                    </div>
                </div>
            </div>

            {/* Average Score */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-4 py-3 transition-all hover:border-amber-500/20 hover:bg-amber-500/2">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15 transition-colors">
                        <Star className="h-4.5 w-4.5 fill-amber-400" />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white tabular-nums">{avgScore}</div>
                        <div className="text-xs text-gray-500">Avg Score</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
