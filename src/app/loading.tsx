/** The home page: the full-bleed hero, then its sections, drawn with the same pieces as the page's own fallbacks. */
import { HeroSkeleton, KDramaSkeleton } from "@/components/home-skeletons";

export default function Loading() {
    return (
        <div className="relative min-h-screen">
            <HeroSkeleton />
            <div className="container py-10 md:py-16 space-y-8 md:space-y-14 m-auto max-w-[95%] md:max-w-[85%] px-2 md:px-0 relative z-10">
                <KDramaSkeleton />
                <KDramaSkeleton />
            </div>
        </div>
    );
}
