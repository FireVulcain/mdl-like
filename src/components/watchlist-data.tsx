import { getWatchlist } from "@/actions/media";
import { type ViewPreferences } from "@/actions/preferences";
import { WatchlistTable } from "@/components/watchlist-table";

type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];

interface WatchlistDataProps {
    watchlist: WatchlistItem[];
    viewPrefs?: ViewPreferences;
}

export function WatchlistData({ watchlist, viewPrefs }: WatchlistDataProps) {
    return (
        <WatchlistTable
            items={watchlist}
            initialThumbnailStyle={viewPrefs?.watchlistThumbnailStyle}
            defaultSort={viewPrefs?.watchlistDefaultSort}
        />
    );
}
