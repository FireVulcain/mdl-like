import { Suspense } from "react";
import { ContinueWatchingData } from "@/components/continue-watching-data";
import { ActorRadarData } from "@/components/actor-radar-data";
import { DramaUniverseSection } from "@/components/drama-universe-section";
import { TrendingData } from "@/components/trending-data";
import { getHomeSections } from "@/actions/preferences";
import { PageBackground } from "@/components/page-background";

export const dynamic = "force-dynamic";

function HeroSkeleton() {
    return (
        <div className="relative h-[90vh] min-h-125 -mt-24 w-full overflow-hidden bg-linear-to-b from-gray-900 to-page animate-pulse">
            <div className="absolute inset-0 bg-linear-to-r from-page via-page/80 to-transparent" />
            <div className="relative h-full flex">
                <div className="flex-1 flex flex-col justify-end pb-16 md:pb-24 pl-[5%] md:pl-[7.5%] space-y-4 md:space-y-6 max-w-xl">
                    {/* Mirrors the real hero: title, hairline progress, one button
                        and a text link. It has to be redrawn whenever that block
                        changes, or the page flashes a layout that no longer
                        exists. */}
                    <div className="space-y-3">
                        <div className="h-12 md:h-16 w-3/4 rounded-xl bg-white/10" />
                        <div className="h-12 md:h-16 w-1/2 rounded-xl bg-white/10" />
                    </div>
                    <div className="space-y-2.5">
                        <div className="h-0.5 w-64 md:w-80 rounded-full bg-white/10" />
                        <div className="h-4 w-44 rounded bg-white/10" />
                    </div>
                    <div className="flex items-center gap-6 pt-2">
                        <div className="h-10 w-32 rounded-lg bg-white/20" />
                        <div className="h-4 w-20 rounded bg-white/10" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function KDramaSkeleton() {
    return (
        <section className="relative space-y-6 md:space-y-10 animate-pulse">
            <div className="space-y-3">
                <div className="h-3 w-40 rounded bg-white/8" />
                <div className="h-9 w-72 rounded-lg bg-white/10" />
                <div className="h-3 w-56 rounded bg-white/5" />
                <div className="h-px w-full bg-white/8" />
            </div>
            <div className="space-y-8">
                {[0, 1].map((i) => (
                    <div key={i} className="space-y-3">
                        <div className="h-4 w-40 rounded bg-white/8" />
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

// Sections are user-configurable (order + visibility) from /settings
function renderSection(id: string) {
    if (id === "actor-radar") {
        return (
            <Suspense key={id} fallback={<KDramaSkeleton />}>
                <ActorRadarData />
            </Suspense>
        );
    }
    if (id === "trending") {
        return (
            <Suspense key={id} fallback={<div className="h-125 animate-pulse bg-white/5 rounded-3xl" />}>
                <TrendingData />
            </Suspense>
        );
    }
    if (id.startsWith("drama-")) {
        return (
            <Suspense key={id} fallback={<KDramaSkeleton />}>
                <DramaUniverseSection country={id.slice(6)} />
            </Suspense>
        );
    }
    return null;
}

export default async function Home() {
    const sections = await getHomeSections();

    return (
        <div className="relative min-h-screen">
            <PageBackground />

            {/* Hero — ContinueWatching: DB-only fetch, resolves in ~10ms */}
            <Suspense fallback={<HeroSkeleton />}>
                <ContinueWatchingData />
            </Suspense>

            {/* Content */}
            <div className="container py-10 md:py-16 space-y-8 md:space-y-14 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0 relative z-10">
                {sections.filter((s) => s.enabled).map((s) => renderSection(s.id))}
            </div>
        </div>
    );
}
