import { MediaCard } from "@/components/media-card";
import { mediaService } from "@/services/media.service";
import { getDashboardStats, backfillGenres } from "@/actions/stats";
import { StatsDashboard } from "@/components/stats/dashboard";

const MOCK_USER_ID = "mock-user-1";

export default async function Home() {
    const trending = await mediaService.getTrending();

    // Backfill genres for legacy items if any
    await backfillGenres(MOCK_USER_ID);

    const stats = await getDashboardStats(MOCK_USER_ID);

    return (
        <div className="container py-8 space-y-12 m-auto max-w-[85%]">
            {/* Dashboard Section */}
            <section className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/50 bg-clip-text text-transparent">
                        Your Media Journey
                    </h1>
                    <p className="text-muted-foreground">Detailed insights into your watching habits and preferences.</p>
                </div>
                <StatsDashboard stats={stats} />
            </section>

            {/* Trending Section */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight">Trending This Week</h2>
                    <div className="h-[1px] flex-1 bg-border mx-4 opacity-50" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {trending.map((media) => (
                        <MediaCard key={media.id} media={media} />
                    ))}
                </div>
            </section>
        </div>
    );
}
