import { getWatchlist } from "@/actions/media";

type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];

interface WatchlistSubtitleProps {
    watchlist: WatchlistItem[];
}

export function WatchlistSubtitle({ watchlist }: WatchlistSubtitleProps) {
    const watchingCount = watchlist.filter((i) => i.status === "Watching").length;
    const completedCount = watchlist.filter((i) => i.totalEp && i.progress >= i.totalEp).length;

    return (
        <p className="text-sm text-muted-foreground mt-0.5">
            {watchlist.length} titles · {watchingCount} watching · {completedCount} completed
        </p>
    );
}
