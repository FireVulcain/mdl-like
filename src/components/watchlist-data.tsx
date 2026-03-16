import { getWatchlist } from "@/actions/media";
import { WatchlistTable } from "@/components/watchlist-table";

type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];

interface WatchlistDataProps {
    watchlist: WatchlistItem[];
}

export function WatchlistData({ watchlist }: WatchlistDataProps) {
    return <WatchlistTable items={watchlist} />;
}
