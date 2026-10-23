import { Suspense } from "react";
import { ContinueWatchingData } from "@/components/continue-watching-data";
import { ActorRadarData } from "@/components/actor-radar-data";
import { DramaUniverseSection } from "@/components/drama-universe-section";
import { TrendingData } from "@/components/trending-data";
import { getHomeSections } from "@/actions/preferences";
import { HeroSkeleton, KDramaSkeleton } from "@/components/home-skeletons";

export const dynamic = "force-dynamic";

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
            <Suspense key={id} fallback={<div className="h-125 animate-pulse bg-surface-2 rounded-3xl" />}>
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
