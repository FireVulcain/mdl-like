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
            <section className="space-y-10 bg-gradient-to-br from-purple-500/[0.07] via-transparent to-transparent p-8 rounded-[2rem] border border-purple-500/10 shadow-xl shadow-purple-500/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-[100px] -z-10" />

                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <h2 className="text-3xl font-black tracking-tighter uppercase italic text-purple-400">K-Drama Universe</h2>
                            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30 animate-pulse">
                                LIVE NOW
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground ml-1">Fresh from Seoul. Trending and currently airing series.</p>
                    </div>
                </div>

                <div className="space-y-12">
                    {/* Trending K-Dramas */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold flex items-center gap-3 group">
                            <div className="w-1.5 h-6 bg-purple-500 rounded-full transition-all group-hover:h-8" />
                            Popular Right Now
                        </h3>
                        <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 overflow-visible">
                            <div className="flex gap-8 py-6 px-4">
                                {kdramas.trending.map((media) => (
                                    <div
                                        key={media.id}
                                        className="w-[220px] flex-shrink-0 transition-transform hover:scale-105 duration-300 hover:z-10"
                                    >
                                        <MediaCard media={media} />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>

                    {/* Airing Now K-Dramas */}
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold flex items-center gap-3 group">
                            <div className="w-1.5 h-6 bg-emerald-500 rounded-full transition-all group-hover:h-8" />
                            Airing Now
                        </h3>
                        <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 overflow-visible">
                            <div className="flex gap-8 py-6 px-4">
                                {kdramas.airing.map((media) => (
                                    <div
                                        key={media.id}
                                        className="w-[220px] flex-shrink-0 transition-transform hover:scale-105 duration-300 hover:z-10"
                                    >
                                        <MediaCard media={media} />
                                    </div>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" />
                        </ScrollArea>
                    </div>
                </div>
            </section>

            {/* Trending Section */}
            <TrendingSection items={trending} />
        </div>
    );
}
