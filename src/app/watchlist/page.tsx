import { getWatchlist } from "@/actions/media";
import { WatchlistTable } from "@/components/watchlist-table";

// Mock User ID
const MOCK_USER_ID = "mock-user-1";

// Force dynamic rendering - don't prerender at build time
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WatchlistPage() {
    // Handle build time gracefully
    let watchlist = [];

    try {
        // Skip database during build phase
        if (process.env.NEXT_PHASE !== "phase-production-build") {
            watchlist = await getWatchlist(MOCK_USER_ID);
        }
    } catch (error) {
        console.error("Error fetching watchlist:", error);
        // Return empty array on error
    }

    return (
        <div className="container py-8 space-y-6 m-auto max-w-[80%]">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
            </div>

            <WatchlistTable items={watchlist} />
        </div>
    );
}
