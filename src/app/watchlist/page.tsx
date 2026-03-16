import { WatchlistData } from "@/components/watchlist-data";
import { WatchlistHeaderStats } from "@/components/watchlist-header-stats";
import { WatchlistSubtitle } from "@/components/watchlist-subtitle";
import { getWatchlist } from "@/actions/media";
import { getDashboardStats } from "@/actions/stats";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
    const watchlist = await getWatchlist();
    const stats = await getDashboardStats(watchlist);

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
                    <svg width="100%" height="100%">
                        <filter id="noise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                </div>
            </div>

            {/* Content */}
            <div className="container py-6 m-auto md:max-w-[80%] relative z-10 space-y-4 px-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
                        <WatchlistSubtitle watchlist={watchlist} />
                    </div>
                    <WatchlistHeaderStats stats={stats} />
                </div>
                <WatchlistData watchlist={watchlist} />
            </div>
        </div>
    );
}
