import { mediaService } from "@/services/media.service";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { TrendingSection } from "@/components/trending-section";

export async function TrendingData() {
    // Trending items are TMDB-sourced, so their externalId matches the watchlist
    // ids directly — none of the slug resolution the MDL rows need.
    const [trending, watchlistExternalIds] = await Promise.all([
        mediaService.getTrending(),
        getWatchlistExternalIds(),
    ]);
    return <TrendingSection items={trending} watchlistIds={watchlistExternalIds} />;
}
