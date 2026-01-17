import { getWatchlist } from "@/actions/media";
import { getDashboardStats } from "@/actions/stats";
import { EMPTY_STATS } from "@/types/stats";
import { WatchlistTable } from "@/components/watchlist-table";
import { WatchlistStats } from "@/components/watchlist-stats";

const MOCK_USER_ID = "mock-user-1";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WatchlistPage() {
    let watchlist: Awaited<ReturnType<typeof getWatchlist>> = [];
    let stats = EMPTY_STATS;

    try {
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            [watchlist, stats] = await Promise.all([
                getWatchlist(MOCK_USER_ID),
                getDashboardStats(MOCK_USER_ID)
            ]);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }

    const watchingCount = watchlist.filter(i => i.status === "Watching").length;
    const completedCount = watchlist.filter(i => i.totalEp && i.progress >= i.totalEp).length;

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 -z-10">
                {/* Base gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-gray-950 to-slate-900" />

                {/* Floating ambient glow effects */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-500/20 rounded-full blur-[140px] animate-float-slow" />
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-purple-500/18 rounded-full blur-[140px] animate-float-slower" />
                <div className="absolute bottom-0 left-1/3 w-[550px] h-[550px] bg-violet-500/16 rounded-full blur-[140px] animate-float-slowest" />
                <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-cyan-500/14 rounded-full blur-[140px] animate-float-reverse" />
                
                {/* Noise texture overlay */}
                <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay">
                    <svg width="100%" height="100%">
                        <filter id="noise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                </div>
            </div>

            {/* Content */}
            <div className="container py-8 space-y-6 m-auto max-w-[80%] relative z-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
                        <p className="text-muted-foreground mt-1">
                            {watchlist.length} titles · {watchingCount} watching · {completedCount} completed
                        </p>
                    </div>

                    <WatchlistStats stats={stats} />
                </div>

                <WatchlistTable items={watchlist} />
            </div>
        </div>
    );
}
