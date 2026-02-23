import { Suspense } from "react";
import { ContinueWatchingData } from "@/components/continue-watching-data";
import { KDramaSectionData } from "@/components/kdrama-section-data";
import { TrendingData } from "@/components/trending-data";

export const dynamic = "force-dynamic";

function HeroSkeleton() {
    return (
        <div className="relative h-[90vh] min-h-125 -mt-24 w-full overflow-hidden bg-linear-to-b from-gray-900 to-[#0a0a0f] animate-pulse">
            <div className="absolute inset-0 bg-linear-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
            <div className="relative h-full flex">
                <div className="flex-1 flex flex-col justify-end pb-16 md:pb-24 pl-[5%] md:pl-[7.5%] space-y-4 md:space-y-6 max-w-xl">
                    <div className="h-6 w-40 rounded-full bg-blue-500/20 border border-blue-500/30" />
                    <div className="space-y-3">
                        <div className="h-12 md:h-16 w-3/4 rounded-xl bg-white/10" />
                        <div className="h-12 md:h-16 w-1/2 rounded-xl bg-white/10" />
                    </div>
                    <div className="h-4 w-56 rounded bg-white/10" />
                    <div className="h-1.5 w-64 md:w-80 rounded-full bg-white/10" />
                    <div className="flex gap-4 pt-2">
                        <div className="h-12 w-32 rounded-xl bg-blue-500/30" />
                        <div className="h-12 w-36 rounded-xl bg-white/10 border border-white/10" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function KDramaSkeleton() {
    return (
        <section className="relative space-y-6 md:space-y-8 bg-white/2 p-4 md:p-8 rounded-xl border border-white/5 animate-pulse">
            <div className="h-8 w-56 rounded-lg bg-white/10" />
            <div className="space-y-8">
                {[0, 1].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="h-5 w-40 rounded bg-white/10" />
                        <div className="flex gap-4 overflow-hidden">
                            {Array.from({ length: 6 }).map((_, j) => (
                                <div key={j} className="w-32 sm:w-40 md:w-55 shrink-0 aspect-2/3 rounded-xl bg-white/5" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function Home() {
    return (
        <div className="relative min-h-screen">
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

            {/* Hero — ContinueWatching: DB-only fetch, resolves in ~10ms */}
            <Suspense fallback={<HeroSkeleton />}>
                <ContinueWatchingData />
            </Suspense>

            {/* Content */}
            <div className="container py-6 md:py-8 space-y-12 md:space-y-24 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0 relative z-10">
                {/* K-Drama section — 3 parallel TMDB calls */}
                <Suspense fallback={<KDramaSkeleton />}>
                    <KDramaSectionData />
                </Suspense>

                {/* Trending section — 1 TMDB call */}
                <Suspense fallback={<div className="h-125 animate-pulse bg-white/5 rounded-3xl" />}>
                    <TrendingData />
                </Suspense>
            </div>
        </div>
    );
}
