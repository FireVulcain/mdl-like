import { WatchlistData } from "@/components/watchlist-data";
import { WatchlistHeaderStats } from "@/components/watchlist-header-stats";
import { WatchlistSubtitle } from "@/components/watchlist-subtitle";
import { getWatchlist } from "@/actions/media";
import { getWatchlistHeaderStats } from "@/actions/stats";
import { getViewPreferences, getDisplayPreferences } from "@/actions/preferences";
import { getNativeTitlesAndBackfill } from "@/lib/native-titles";
import { PageBackground } from "@/components/page-background";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
    const [watchlist, viewPrefs, displayPrefs] = await Promise.all([getWatchlist(), getViewPreferences(), getDisplayPreferences()]);
    // Pure computation over the rows we already have — no extra queries
    const stats = await getWatchlistHeaderStats(watchlist);

    // Display-only native titles (stored titles stay english — they feed
    // TVmaze/MDL matching); items without an MDL link keep their title.
    let displayWatchlist = watchlist;
    if (displayPrefs.titleLanguage === "native") {
        const slugs = watchlist.map((i) => i.mdlSlug).filter((s): s is string => !!s);
        const titles = await getNativeTitlesAndBackfill(slugs);
        displayWatchlist = watchlist.map((i) => {
            const native = i.mdlSlug ? titles.get(i.mdlSlug) : undefined;
            return native ? { ...i, title: native } : i;
        });
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <PageBackground />

            {/* Content */}
            <div className="container py-6 m-auto md:max-w-[80%] relative z-10 space-y-4 px-4">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div>
                        <h1 className="font-display text-3xl font-bold tracking-tight">My Watchlist</h1>
                        <WatchlistSubtitle watchlist={watchlist} />
                    </div>
                    <WatchlistHeaderStats stats={stats} />
                </div>
                <WatchlistData watchlist={displayWatchlist} viewPrefs={viewPrefs} />
            </div>
        </div>
    );
}
