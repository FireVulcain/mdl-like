import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";
import { getContinueWatching } from "@/actions/stats";
import { ContinueWatching } from "@/components/continue-watching";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import dynamic from "next/dynamic";

// Dynamically import TrendingSection (below the fold) to reduce initial JS bundle
const TrendingSection = dynamic(() => import("@/components/trending-section").then(mod => mod.TrendingSection), {
    loading: () => <div className="h-[500px] animate-pulse bg-white/5 rounded-3xl" />,
});

const MOCK_USER_ID = "mock-user-1";

export default async function Home() {
    // Parallel fetch: all 3 operations are independent
    const [trending, kdramas, continueWatchingItems] = await Promise.all([
        mediaService.getTrending(),
        mediaService.getKDramas(),
        getContinueWatching(MOCK_USER_ID),
    ]);

    return (
        <div className="container py-6 md:py-8 space-y-12 md:space-y-24 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0">
            {/* Continue Watching Section */}
            <ContinueWatching items={continueWatchingItems} />

            {/* K-Drama Special Section */}
            <section className="relative space-y-6 md:space-y-8 bg-linear-to-br from-white/3 to-white/1 backdrop-blur-sm p-4 md:p-8 rounded-xl border border-white/10 shadow-lg overflow-hidden">
                {/* Atmospheric Background Effects */}
                <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-purple-500/10 rounded-full blur-[80px] md:blur-[120px] -z-10" />
                <div className="absolute bottom-0 left-0 w-48 md:w-96 h-48 md:h-96 bg-pink-500/10 rounded-full blur-[80px] md:blur-[120px] -z-10" />
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-1 md:space-y-2">
                        <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                            <h2 className="text-xl md:text-3xl font-bold text-white">K-Drama Universe</h2>
                            <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                                <div className="w-1.5 md:w-2 h-1.5 md:h-2 rounded-full bg-purple-500 animate-pulse" />
                                <span className="text-[10px] md:text-xs font-medium text-purple-300">LIVE</span>
                            </div>
                        </div>
                        <p className="text-xs md:text-sm text-gray-400">Fresh from Seoul · Trending and currently airing series</p>
                    </div>
                </div>

                <div className="space-y-6 md:space-y-10">
                    {/* Trending K-Dramas */}
                    <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-1 h-5 md:h-6 bg-linear-to-b from-purple-500 to-pink-500 rounded-full" />
                            <h3 className="text-base md:text-lg font-semibold text-white">Popular Right Now</h3>
                            <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                            <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                                {kdramas.trending.map((media) => (
                                    <div key={media.id} className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300">
                                        <MediaCard media={media} />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="opacity-50" />
                        </ScrollArea>
                    </div>

                    {/* Airing Now K-Dramas */}
                    <div className="space-y-3 md:space-y-4">
                        <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-1 h-5 md:h-6 bg-linear-to-b from-emerald-500 to-cyan-500 rounded-full" />
                            <h3 className="text-base md:text-lg font-semibold text-white">Airing Now</h3>
                            <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4">
                            <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                                {kdramas.airing.map((media) => (
                                    <div key={media.id} className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300">
                                        <MediaCard media={media} />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="opacity-50" />
                        </ScrollArea>
                    </div>
                </div>
            </section>

            {/* Trending Section */}
            <TrendingSection items={trending} />
        </div>
    );
}
