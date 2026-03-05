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
        <div className="hidden md:flex gap-2 watchlist-stats">
            {/* Watch Time */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-3 py-2 md:px-4 md:py-3 transition-all hover:border-blue-500/20 hover:bg-blue-500/2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/15 transition-colors shrink-0">
                        <Clock className="h-4.5 w-4.5" />
                    </div>
                    <Clock className="md:hidden h-4 w-4 text-blue-400 shrink-0" />
                    <div>
                        <div className="text-base md:text-xl font-bold text-white tabular-nums">{watchTimeHours}h</div>
                        <div className="text-xs text-gray-500">Watched</div>
                    </div>
                </div>
            </div>

            {/* Completion Rate */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-3 py-2 md:px-4 md:py-3 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/15 transition-colors shrink-0">
                        <Target className="h-4.5 w-4.5" />
                    </div>
                    <Target className="md:hidden h-4 w-4 text-emerald-400 shrink-0" />
                    <div>
                        <div className="text-base md:text-xl font-bold text-white tabular-nums">{Math.round(stats.completionRate)}%</div>
                        <div className="text-xs text-gray-500">Completion</div>
                    </div>
                </div>
            </div>

            {/* Average Score */}
            <div className="group relative bg-white/2 rounded-xl border border-white/5 px-3 py-2 md:px-4 md:py-3 transition-all hover:border-amber-500/20 hover:bg-amber-500/2">
                <div className="flex items-center gap-2 md:gap-3">
                    <div className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 group-hover:bg-amber-500/15 transition-colors shrink-0">
                        <Star className="h-4.5 w-4.5 fill-amber-400" />
                    </div>
                    <Star className="md:hidden h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                    <div>
                        <div className="text-base md:text-xl font-bold text-white tabular-nums">{avgScore}</div>
                        <div className="text-xs text-gray-500">Avg Score</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
