import { WatchlistData } from "@/components/watchlist-data";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

function WatchlistSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            <div className="flex items-center justify-between">
                <div className="h-4 w-48 rounded bg-white/10" />
                <div className="flex gap-2">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-16 w-32 rounded-xl bg-white/5 border border-white/5" />
                    ))}
                </div>
            </div>
            <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-white/5 border border-white/5" />
                ))}
            </div>
        </div>
    );
}

export default function WatchlistPage() {
    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                {/* Deep dark base */}
                <div className="absolute inset-0 bg-[#0a0a0f]" />

                {/* Subtle radial gradient for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />

                {/* Accent glows at edges only - not interfering with content */}
                <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-blue-500/12 rounded-full blur-[180px]" />

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

            {/* Content */}
            <div className="container py-8 space-y-6 m-auto max-w-[80%] relative z-10">
                <h1 className="text-3xl font-bold tracking-tight">My Watchlist</h1>
                <Suspense fallback={<WatchlistSkeleton />}>
                    <WatchlistData />
                </Suspense>
            </div>
        </div>
    );
}
