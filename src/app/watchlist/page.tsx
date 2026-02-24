import { WatchlistData } from "@/components/watchlist-data";
import { WatchlistHeaderStats } from "@/components/watchlist-header-stats";
import { WatchlistSubtitle } from "@/components/watchlist-subtitle";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function StatsSkeleton() {
    return (
        <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 w-32 rounded-xl bg-white/5 border border-white/5 animate-pulse" />
            ))}
        </div>
    );
}

function TableSkeleton() {
    return (
        <div className="space-y-3 animate-pulse">
            <div className="h-4 w-56 rounded bg-white/5" />
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/5" />
            ))}
        </div>
    );
}

export default function WatchlistPage() {
    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
                <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay">
                    <svg width="100%" height="100%">
                        <filter id="noise">
                            <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" />
                        </filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                </div>
            </div>

            {/* Content */}
            <div className="container py-8 m-auto max-w-[80%] relative z-10 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
                        <Suspense fallback={<div className="h-4 w-56 rounded bg-white/5 animate-pulse mt-1" />}>
                            <WatchlistSubtitle />
                        </Suspense>
                    </div>
                    <Suspense fallback={<StatsSkeleton />}>
                        <WatchlistHeaderStats />
                    </Suspense>
                </div>
                <Suspense fallback={<TableSkeleton />}>
                    <WatchlistData />
                </Suspense>
            </div>
        </div>
    );
}
