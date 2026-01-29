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
            watchlist = await getWatchlist(MOCK_USER_ID);
            stats = await getDashboardStats(MOCK_USER_ID, watchlist);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }

    const watchingCount = watchlist.filter((i) => i.status === "Watching").length;
    const completedCount = watchlist.filter((i) => i.totalEp && i.progress >= i.totalEp).length;

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                {/* Deep dark base */}
                <div className="absolute inset-0 bg-[#0a0a0f]" />

                {/* Subtle radial gradient for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />

                {/* Accent glows at edges only - not interfering with content */}
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/12 rounded-full blur-[180px]" />

                {/* Noise texture overlay */}
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
            <div className="container py-8 space-y-6 m-auto max-w-[80%] relative z-10">
                <div className="flex items-center justify-between watchlist-header">
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
