import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";
import { getDashboardStats, backfillGenres } from "@/actions/stats";
import { StatsDashboard } from "@/components/stats/dashboard";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TrendingSection } from "@/components/trending-section";

const MOCK_USER_ID = "mock-user-1";

export default async function Home() {
    const trending = await mediaService.getTrending();
    const kdramas = await mediaService.getKDramas();

    // Backfill genres for legacy items if any
    await backfillGenres(MOCK_USER_ID);

    const stats = await getDashboardStats(MOCK_USER_ID);

    return (
        <div className="container py-8 space-y-24 m-auto max-w-[85%]">
            {/* Dashboard Section */}
            <section className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent underline decoration-primary/20 underline-offset-8">
                        Your Media Journey
                    </h1>
                    <p className="text-muted-foreground mt-2">Detailed insights into your watching habits and preferences.</p>
                </div>
                <StatsDashboard stats={stats} />
            </section>

            {/* K-Drama Special Section */}
            <section className="relative space-y-8 bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm p-8 rounded-xl border border-white/10 shadow-lg overflow-hidden">
                {/* Atmospheric Background Effects */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] -z-10" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] -z-10" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-bold text-white">
                                K-Drama Universe
                            </h2>
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                <span className="text-xs font-medium text-purple-300">LIVE</span>
                            </div>
                        </div>
                        <p className="text-sm text-gray-400">Fresh from Seoul · Trending and currently airing series</p>
                    </div>
                </div>

                <div className="space-y-10">
                    {/* Trending K-Dramas */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                            <h3 className="text-lg font-semibold text-white">Popular Right Now</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
                            <div className="flex gap-6 py-4 px-4">
                                {kdramas.trending.map((media) => (
                                    <div
                                        key={media.id}
                                        className="w-[220px] flex-shrink-0 transition-transform hover:scale-105 duration-300"
                                    >
                                        <MediaCard media={media} />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="opacity-50" />
                        </ScrollArea>
                    </div>

                    {/* Airing Now K-Dramas */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
                            <h3 className="text-lg font-semibold text-white">Airing Now</h3>
                            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                        </div>
                        <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
                            <div className="flex gap-6 py-4 px-4">
                                {kdramas.airing.map((media) => (
                                    <div
                                        key={media.id}
                                        className="w-[220px] flex-shrink-0 transition-transform hover:scale-105 duration-300"
                                    >
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
