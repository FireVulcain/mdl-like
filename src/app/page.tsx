import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";
import { getContinueWatching } from "@/actions/stats";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { ContinueWatching } from "@/components/continue-watching";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Bookmark } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import TrendingSection (below the fold) to reduce initial JS bundle
const TrendingSection = dynamic(() => import("@/components/trending-section").then((mod) => mod.TrendingSection), {
    loading: () => <div className="h-125 animate-pulse bg-white/5 rounded-3xl" />,
});

const MOCK_USER_ID = "mock-user-1";

export default async function Home() {
    // Parallel fetch: all operations are independent
    const [trending, kdramas, continueWatchingItems, watchlistExternalIds] = await Promise.all([
        mediaService.getTrending(),
        mediaService.getKDramas(),
        getContinueWatching(MOCK_USER_ID),
        getWatchlistExternalIds(),
    ]);
    const watchlistIds = new Set(watchlistExternalIds);

    return (
        <div className="relative min-h-screen">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                {/* Deep dark base */}
                <div className="absolute inset-0 bg-[#0a0a0f]" />

                {/* Subtle radial gradient for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />

                {/* Accent glows at edges only */}
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />

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

            {/* Hero - Continue Watching (outside container, full bleed) */}
            <ContinueWatching items={continueWatchingItems} />

            {/* Content */}
            <div className="container py-6 md:py-8 space-y-12 md:space-y-24 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0 relative z-10">
                {/* K-Drama Special Section */}
                <section className="relative space-y-6 md:space-y-8 bg-white/2 backdrop-blur-sm p-4 md:p-8 rounded-xl border border-white/5 shadow-lg overflow-hidden">
                    {/* Atmospheric Background Effects */}
                    <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-blue-500/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
                    <div className="absolute bottom-0 left-0 w-48 md:w-96 h-48 md:h-96 bg-blue-600/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
                    <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1 md:space-y-2">
                            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                                <h2 className="text-xl md:text-3xl font-bold text-white">K-Drama Universe</h2>
                                <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                                    <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[10px] md:text-xs font-medium text-blue-300">LIVE</span>
                                </div>
                            </div>
                            <p className="text-xs md:text-sm text-gray-400">Fresh from Seoul · Trending, airing, and upcoming series</p>
                        </div>
                    </div>

                    <div className="space-y-6 md:space-y-10">
                        {/* Trending K-Dramas */}
                        <div className="space-y-3 md:space-y-4">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-1 h-5 md:h-6 bg-linear-to-b from-blue-500 to-blue-400 rounded-full" />
                                <h3 className="text-base md:text-lg font-semibold text-white">Popular Right Now</h3>
                                <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                                <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                                    {kdramas.trending.map((media) => (
                                        <div
                                            key={media.id}
                                            className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300"
                                        >
                                            <MediaCard
                                                media={media}
                                                overlay={
                                                    watchlistIds.has(media.externalId) ? (
                                                        <div className="absolute bottom-2 left-2">
                                                            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                                            </span>
                                                        </div>
                                                    ) : null
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="opacity-50" />
                            </ScrollArea>
                        </div>

                        {/* Airing Now K-Dramas */}
                        <div className="space-y-3 md:space-y-4">
                            <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-1 h-5 md:h-6 bg-linear-to-b from-emerald-500 to-emerald-400 rounded-full" />
                                <h3 className="text-base md:text-lg font-semibold text-white">Airing Now</h3>
                                <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                                <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                                    {kdramas.airing.map((media) => (
                                        <div
                                            key={media.id}
                                            className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300"
                                        >
                                            <MediaCard
                                                media={media}
                                                overlay={
                                                    watchlistIds.has(media.externalId) ? (
                                                        <div className="absolute bottom-2 left-2">
                                                            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                                            </span>
                                                        </div>
                                                    ) : null
                                                }
                                            />
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="opacity-50" />
                            </ScrollArea>
                        </div>

                        {/* Upcoming K-Dramas */}
                        {kdramas.upcoming.length > 0 && (
                            <div className="space-y-3 md:space-y-4">
                                <div className="flex items-center gap-2 md:gap-3">
                                    <div className="w-1 h-5 md:h-6 bg-linear-to-b from-amber-500 to-amber-400 rounded-full" />
                                    <h3 className="text-base md:text-lg font-semibold text-white">Coming Soon</h3>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>
                                <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                                    <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                                        {kdramas.upcoming.map((media) => (
                                            <div
                                                key={media.id}
                                                className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300"
                                            >
                                                <MediaCard
                                                    media={media}
                                                    sizes="(max-width: 768px) 200vw, 1200px"
                                                    overlay={
                                                        <>
                                                            {media.firstAirDate && (
                                                                <span className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-amber-400">
                                                                    {new Date(media.firstAirDate + "T00:00:00").toLocaleDateString("en-US", {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                        year: "numeric",
                                                                    })}
                                                                </span>
                                                            )}
                                                            {watchlistIds.has(media.externalId) && (
                                                                <div className="absolute bottom-2 right-2">
                                                                    <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                                        <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </>
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <ScrollBar orientation="horizontal" className="opacity-50" />
                                </ScrollArea>
                            </div>
                        )}
                    </div>
                </section>

                {/* Trending Section */}
                <TrendingSection items={trending} />
            </div>
        </div>
    );
}
