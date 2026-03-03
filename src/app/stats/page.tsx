import { getDashboardStats, getContinueWatching, getTopActors } from "@/actions/stats";
import { StatsDashboard } from "@/components/stats/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StatsPage() {
    const [stats, continueWatching, topActors] = await Promise.all([
        getDashboardStats(),
        getContinueWatching(),
        getTopActors(),
    ]);

    const statsWithActors = { ...stats, topActors };

    return (
        <div className="relative min-h-screen overflow-hidden">
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[180px]" />
            </div>

            <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">My Stats</h1>
                    <p className="text-muted-foreground mt-1">A breakdown of your watching habits</p>
                </div>
                <StatsDashboard stats={statsWithActors} continueWatching={continueWatching} />
            </div>
        </div>
    );
}
