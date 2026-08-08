import Image from "next/image";
import Link from "next/link";
import { getActorRadar, type ActorRadarItem } from "@/actions/actor-radar";
import { HomeSectionHeader } from "@/components/home-section-header";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { DragScroll } from "@/components/drag-scroll";
import { ImageOff, Settings2, Star, UserRound } from "lucide-react";

// Radar card: same composition as the drama rows' airing cards — poster with
// its text stacked underneath, no frame — one size down. This section is a
// suggestion, not a schedule, and a drama universe carries three rows where this
// carries one. The size gap is also what tells this row apart from Airing Now,
// now that the two share a composition.
function RadarCard({ item }: { item: ActorRadarItem }) {
    const href = item.tmdbId
        ? `/media/tmdb-${item.tmdbId}${item.season && item.season > 1 ? `?season=${item.season}` : ""}`
        : `/media/mdl-${item.slug}`;
    const actor = item.actors[0];

    return (
        <Link href={href} className="group shrink-0 w-28 sm:w-32 md:w-36 whitespace-normal">
            <div className="relative aspect-2/3 w-full rounded-md overflow-hidden bg-white/5">
                {item.poster ? (
                    <Image
                        unoptimized
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="144px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                        <ImageOff className="h-4 w-4" />
                    </div>
                )}
            </div>

            <div className="pt-1.5 space-y-0.5">
                <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {item.title}
                </p>
                {/* Plain text, bullet separator — the same meta line as the airing
                    cards, rather than the chip the year used to sit in. TBA keeps
                    its amber, as colour rather than as a box. */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-white/60">
                    <span className={item.year === "TBA" ? "text-amber-400 font-medium" : ""}>{item.year}</span>
                    {item.rating > 0 && (
                        <>
                            <span className="text-white/30">·</span>
                            <span className="flex items-center gap-0.5 text-sky-400 font-semibold">
                                <Star className="h-2.5 w-2.5 fill-current" />
                                {item.rating.toFixed(1)}
                            </span>
                        </>
                    )}
                </div>
                {actor && (
                    <div className="flex items-center gap-1">
                        {actor.profileImage ? (
                            <Image
                                unoptimized
                                src={actor.profileImage}
                                alt={actor.name}
                                width={14}
                                height={14}
                                className="h-3.5 w-3.5 rounded-full object-cover shrink-0"
                            />
                        ) : (
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/10 shrink-0">
                                <UserRound className="h-2 w-2 text-gray-400" />
                            </span>
                        )}
                        <span className="text-[10px] text-violet-300/80 truncate">
                            {actor.name}
                            {item.actors.length > 1 && <span className="text-gray-500"> +{item.actors.length - 1}</span>}
                        </span>
                    </div>
                )}
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
        <section className="relative space-y-3 md:space-y-5">
            {/* Ambient glow anchored to the page, not a box */}
            <div className="absolute -top-24 left-1/4 w-120 h-120 bg-violet-500/6 rounded-full blur-[160px] -z-10 pointer-events-none hidden md:block" />

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
                                    width={28}
                                    height={28}
                                    className="h-7 w-7 rounded-full object-cover ring-2 ring-page"
                                />
                            ) : null,
                        )}
                        <Link
                            href="/settings"
                            title="Manage actors in Settings"
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white ring-2 ring-page transition-all shrink-0"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
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
                <DragScroll>
                <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4" viewportStyle={{ overflowY: "hidden" }}>
                    <div className="flex gap-3 md:gap-4 py-2 md:py-3">
                        {payload.items.map((item) => (
                            <RadarCard key={item.mdlId} item={item} />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="opacity-50" />
                </ScrollArea>
                </DragScroll>
            )}
        </section>
    );
}
