import { notFound } from "next/navigation";
import { getPublicUser, getPublicActivity, getPublicStats } from "@/actions/public-profile";
import { getPublicWatchlist } from "@/actions/media";
import { WatchlistTable } from "@/components/watchlist-table";
import { PublicActivityFeed } from "@/components/public-activity-feed";
import { Star, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function formatWatchTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [user, watchlist, activity, stats] = await Promise.all([
        getPublicUser(id),
        getPublicWatchlist(id),
        getPublicActivity(id, 20),
        getPublicStats(id),
    ]);

    if (!user) notFound();

    const displayName = user.name ?? "Anonymous";
    const totalItems = stats.totalShows + stats.totalMovies;

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
            </div>

            {/* Content */}
            <div className="container py-10 m-auto max-w-[80%] relative z-10 space-y-8">

                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        {displayName}&apos;s Watchlist
                    </h1>
                    <p className="mt-1 text-gray-400 text-sm">
                        {stats.totalShows} show{stats.totalShows !== 1 ? "s" : ""} ·{" "}
                        {stats.totalMovies} movie{stats.totalMovies !== 1 ? "s" : ""} ·{" "}
                        {formatWatchTime(stats.watchTimeMinutes)} watched
                    </p>
                </div>

                {/* Stats row */}
                {totalItems > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {stats.avgScore != null && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                                <div>
                                    <p className="text-xs text-gray-400 leading-none">Avg score</p>
                                    <p className="text-white font-semibold text-sm">{stats.avgScore.toFixed(1)}</p>
                                </div>
                            </div>
                        )}
                        {Object.entries(stats.statusBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count]) => (
                                <div key={status} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/8">
                                    <p className="text-xs text-gray-400 leading-none">{status}</p>
                                    <p className="text-white font-semibold text-sm">{count}</p>
                                </div>
                            ))}
                        {stats.topGenres.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8">
                                <span className="text-xs text-gray-400 mr-1">Top genres:</span>
                                {stats.topGenres.map((g) => (
                                    <span key={g.name} className="text-xs px-2 py-0.5 rounded-md bg-white/8 text-gray-300">
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Recent Activity */}
                {activity.length > 0 && (
                    <div>
                        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-400" />
                            Recent Activity
                        </h2>
                        <PublicActivityFeed items={activity} />
                    </div>
                )}

                {/* Watchlist */}
                <div>
                    <h2 className="text-lg font-semibold text-white mb-3">Watchlist</h2>
                    {watchlist.length === 0 ? (
                        <p className="text-gray-500 text-sm">This watchlist is empty.</p>
                    ) : (
                        <WatchlistTable items={watchlist} readOnly />
                    )}
                </div>
            </div>
        </div>
    );
}
