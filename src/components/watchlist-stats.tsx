import { type DashboardStats } from "@/types/stats";

// Only the three figures this header renders — so the watchlist can compute them
// from its rows instead of running the full dashboard's queries.
interface WatchlistStatsProps {
    stats: Pick<DashboardStats, "watchTimeMinutes" | "completionRate" | "ratingDistribution">;
}

/**
 * Three figures, written as figures.
 *
 * They used to be three identical boxes side by side, each with a small icon in
 * a tinted square, a number and a label — and a hue apiece, blue, emerald and
 * amber, with a matching hover border. None of those colours meant anything:
 * watch time is not more blue than an average score is amber, and the icons
 * repeated what the labels already said.
 *
 * The numbers are what matters here, so they carry the weight and the labels sit
 * under them. Nothing is drawn around any of it.
 */
export function WatchlistStats({ stats }: WatchlistStatsProps) {
    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const avgScore =
        stats.ratingDistribution.length > 0
            ? (
                  stats.ratingDistribution.reduce((sum, r) => sum + r.rating * r.count, 0) /
                  stats.ratingDistribution.reduce((sum, r) => sum + r.count, 0)
              ).toFixed(1)
            : "0.0";

    const figures = [
        { value: `${watchTimeHours}h`, label: "Watched" },
        { value: `${Math.round(stats.completionRate)}%`, label: "Completion" },
        { value: avgScore, label: "Avg Score" },
    ];

    return (
        <div className="hidden md:flex items-baseline gap-8 watchlist-stats">
            {figures.map((f) => (
                <div key={f.label}>
                    <div className="text-xl font-bold text-white tabular-nums leading-tight">{f.value}</div>
                    <div className="text-xs text-gray-500">{f.label}</div>
                </div>
            ))}
        </div>
    );
}
