import Image from "next/image";
import Link from "next/link";
import { getActorRadar, type ActorRadarItem } from "@/actions/actor-radar";
import { HomeSectionHeader } from "@/components/home-section-header";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ImageOff, Settings2, Star, UserRound } from "lucide-react";

// Radar card, in the same visual language as the drama rows' backdrop cards:
// uncropped poster on the left over its own blurred artwork, violet accent.
function RadarCard({ item }: { item: ActorRadarItem }) {
    const href = item.tmdbId
        ? `/media/tmdb-${item.tmdbId}${item.season && item.season > 1 ? `?season=${item.season}` : ""}`
        : `/media/mdl-${item.slug}`;
    const actor = item.actors[0];

    return (
        <Link
            href={href}
            className="group relative shrink-0 w-60 sm:w-72 md:w-80 h-36 sm:h-40 md:h-44 rounded-xl overflow-hidden border border-white/8 hover:border-violet-500/25 transition-colors whitespace-normal"
        >
            {item.poster && (
                <Image
                    unoptimized
                    src={item.poster}
                    alt=""
                    fill
                    sizes="320px"
                    className="object-cover scale-110 blur-2xl opacity-50"
                />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/35 to-black/10" />

            <div className="relative h-full flex items-center gap-3 p-3">
                <div className="relative h-full aspect-2/3 rounded-md overflow-hidden shadow-xl shadow-black/60 shrink-0 bg-gray-800">
                    {item.poster ? (
                        <Image
                            unoptimized
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="120px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                            <ImageOff className="h-4 w-4" />
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-bold text-white leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors">
                        {item.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                        <span
                            className={`px-1.5 py-0.5 rounded font-medium ${
                                item.year === "TBA" ? "bg-amber-500/15 text-amber-400" : "bg-white/8 text-gray-300"
                            }`}
                        >
                            {item.year}
                        </span>
                        {item.rating > 0 && (
                            <span className="flex items-center gap-0.5 text-sky-400 font-semibold">
                                <Star className="h-3 w-3 fill-current" />
                                {item.rating.toFixed(1)}
                            </span>
                        )}
                    </div>
                    {actor && (
                        <div className="flex items-center gap-1.5">
                            {actor.profileImage ? (
                                <Image
                                    unoptimized
                                    src={actor.profileImage}
                                    alt={actor.name}
                                    width={16}
                                    height={16}
                                    className="h-4 w-4 rounded-full object-cover shrink-0"
                                />
                            ) : (
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/10 shrink-0">
                                    <UserRound className="h-2.5 w-2.5 text-gray-400" />
                                </span>
                            )}
                            <span className="text-[11px] text-violet-300/80 truncate">
                                {actor.name}
                                {item.actors.length > 1 && <span className="text-gray-500"> +{item.actors.length - 1}</span>}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
}

export async function ActorRadarData() {
    let payload;
    try {
        payload = await getActorRadar();
    } catch (error) {
        // Expected when logged out (Unauthorized) — anything else deserves a trace
        if (!(error instanceof Error && error.message === "Unauthorized")) {
            console.error("[ActorRadar] failed to load:", error);
        }
        return null;
    }
    // Keep rendering (slim) when everything is excluded, so actors can be restored
    if (!payload || (payload.items.length === 0 && payload.excludedActors.length === 0)) return null;

    return (
        <section className="relative space-y-6 md:space-y-10">
            {/* Ambient glow anchored to the page, not a box */}
            <div className="absolute -top-24 left-1/4 w-72 md:w-120 h-72 md:h-120 bg-violet-500/6 rounded-full blur-[100px] md:blur-[160px] -z-10 pointer-events-none" />

            <HomeSectionHeader
                eyebrow="For You"
                title="From Actors You Watch"
                subtitle="New and upcoming titles starring your favorites"
                accent="violet"
                right={
                    <div className="flex items-center -space-x-2 shrink-0 pb-1">
                        {payload.scannedActors.slice(0, 8).map((actor) =>
                            actor.profileImage ? (
                                <Image
                                    unoptimized
                                    key={actor.slug}
                                    src={actor.profileImage}
                                    alt={actor.name}
                                    title={actor.name}
                                    width={32}
                                    height={32}
                                    className="h-8 w-8 rounded-full object-cover ring-2 ring-[#0a0a0f]"
                                />
                            ) : null,
                        )}
                        <Link
                            href="/settings"
                            title="Manage actors in Settings"
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white ring-2 ring-[#0a0a0f] transition-all shrink-0"
                        >
                            <Settings2 className="h-4 w-4" />
                        </Link>
                    </div>
                }
            />

            {payload.items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                    Nothing on the radar — restore removed actors in{" "}
                    <Link href="/settings" className="text-violet-400 hover:text-violet-300 transition-colors">
                        Settings
                    </Link>
                    .
                </p>
            ) : (
                <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4" viewportStyle={{ overflowY: "hidden" }}>
                    <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                        {payload.items.map((item) => (
                            <RadarCard key={item.mdlId} item={item} />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="opacity-50" />
                </ScrollArea>
            )}
        </section>
    );
}
