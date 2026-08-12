import { getDashboardStats, getContinueWatching, getTopActors } from "@/actions/stats";
import { StatsDashboard } from "@/components/stats/dashboard";
import { PageBackground } from "@/components/page-background";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Stats",
    description: "A breakdown of your watching habits.",
};

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
            <PageBackground />

            <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10">
                <div className="mb-8">
                    <h1 className="font-display text-3xl font-bold tracking-tight">My Stats</h1>
                    <p className="text-muted-foreground mt-1">A breakdown of your watching habits</p>
                </div>
                <StatsDashboard stats={statsWithActors} continueWatching={continueWatching} />
            </div>
        </div>
    );
}
