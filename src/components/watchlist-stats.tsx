import { DashboardStats } from "@/actions/stats";

interface WatchlistStatsProps {
    stats: DashboardStats | null;
    items: any[];
}

export function WatchlistStats({ stats, items }: WatchlistStatsProps) {
    if (!stats) return null;

    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    
    // Calculate completion based on progress (items where progress >= totalEp)
    const completedItems = items.filter(item => 
        item.totalEp && item.progress >= item.totalEp
    ).length;
    const completionPercent = items.length > 0 
        ? Math.round((completedItems / items.length) * 100) 
        : 0;
    
    const avgScore = stats.ratingDistribution.length > 0
        ? (stats.ratingDistribution.reduce((sum, r) => sum + (r.rating * r.count), 0) / 
           stats.ratingDistribution.reduce((sum, r) => sum + r.count, 0)).toFixed(1)
        : "0.0";

    return (
        <div className="flex gap-4">
            <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm rounded-lg border border-white/10 px-6 py-4 shadow-md shadow-black/20">
                <div className="text-3xl font-bold text-white">{watchTimeHours}h</div>
                <div className="text-sm text-gray-400 mt-1">Total Watched</div>
            </div>
            
            <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm rounded-lg border border-white/10 px-6 py-4 shadow-md shadow-black/20">
                <div className="text-3xl font-bold text-white">{completionPercent}%</div>
                <div className="text-sm text-gray-400 mt-1">Completion</div>
            </div>
            
            <div className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm rounded-lg border border-white/10 px-6 py-4 shadow-md shadow-black/20">
                <div className="flex items-center gap-2">
                    <svg className="h-6 w-6 text-yellow-500 fill-yellow-500" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span className="text-3xl font-bold text-white">{avgScore}</span>
                </div>
                <div className="text-sm text-gray-400 mt-1">Avg Score</div>
            </div>
        </div>
    );
}
