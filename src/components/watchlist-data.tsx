import { getWatchlist } from "@/actions/media";
import { type ViewPreferences } from "@/actions/preferences";
import { getCachedNextEpisodes } from "@/lib/next-episode-cache";
import { WatchlistTable } from "@/components/watchlist-table";

type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];

interface WatchlistDataProps {
    watchlist: WatchlistItem[];
    viewPrefs?: ViewPreferences;
}

// Read the next-episode DB cache server-side so countdowns are in the initial
// HTML — the client still refreshes (and corrects for timezone) in the
// background, but cached rows no longer wait on a client round-trip.
async function getInitialNextEpisodes(watchlist: WatchlistItem[]): Promise<Record<string, { airDate: string; airDateTime?: string | null; episodeNumber: number; seasonNumber: number; name?: string }>> {
    const airing = watchlist.filter(
        (i) =>
            (i.status === "Watching" || i.status === "Plan to Watch") &&
            (i.airingStatus === "Returning Series" || i.airingStatus === "In Production") &&
            i.mediaType === "TV" &&
            i.source === "TMDB",
    );
    if (airing.length === 0) return {};

    const cached = await getCachedNextEpisodes(airing.map((i) => ({ mediaId: i.externalId, seasonNumber: i.season })));
    const result: Record<string, { airDate: string; airDateTime?: string | null; episodeNumber: number; seasonNumber: number; name?: string }> = {};
    for (const [key, ep] of cached) {
        result[key] = {
            airDate: ep.airDate,
            airDateTime: ep.airDateTime,
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber,
            name: ep.episodeName ?? undefined,
        };
    }
    return result;
}

export async function WatchlistData({ watchlist, viewPrefs }: WatchlistDataProps) {
    const initialNextEpisodes = await getInitialNextEpisodes(watchlist);
    return (
        <WatchlistTable
            items={watchlist}
            initialThumbnailStyle={viewPrefs?.watchlistThumbnailStyle}
            defaultSort={viewPrefs?.watchlistDefaultSort}
            initialNextEpisodes={initialNextEpisodes}
        />
    );
}
