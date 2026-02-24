import { cache } from "react";
import { getWatchlist } from "@/actions/media";
import { WatchlistTable } from "@/components/watchlist-table";

const MOCK_USER_ID = "mock-user-1";

export const getCachedWatchlist = cache(() => getWatchlist(MOCK_USER_ID));

export async function WatchlistData() {
    let watchlist: Awaited<ReturnType<typeof getWatchlist>> = [];

    try {
        watchlist = await getCachedWatchlist();
    } catch (error) {
        console.error("Error fetching watchlist data:", error);
    }

    return <WatchlistTable items={watchlist} />;
}
