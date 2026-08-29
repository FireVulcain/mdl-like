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
            <div className="relative aspect-2/3 w-full rounded-md overflow-hidden bg-surface-2">
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
                    <div className="absolute inset-0 flex items-center justify-center text-fg-faint">
                        <ImageOff className="h-4 w-4" />
                    </div>
                )}
            </div>

            <div className="pt-1.5 space-y-0.5">
                <p className="text-sm font-semibold text-fg leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors">
                    {item.title}
                </p>
                {/* Plain text, bullet separator — the same meta line as the airing
                    cards, rather than the chip the year used to sit in. TBA keeps
                    its amber, as colour rather than as a box. */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-fg-muted">
                    <span className={item.year === "TBA" ? "text-amber-400 font-medium" : ""}>{item.year}</span>
                    {item.rating > 0 && (
                        <>
                            <span className="text-fg-faint">·</span>
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
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface-4 shrink-0">
                                <UserRound className="h-2 w-2 text-fg-muted" />
                            </span>
                        )}
                        <span className="text-[11px] text-violet-300/80 truncate">
                            {actor.name}
                            {item.actors.length > 1 && <span className="text-fg-dim"> +{item.actors.length - 1}</span>}
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
        // Same vertical rhythm as the universe sections. It ran tighter for a
        // while, which made the spacing visibly shift between two adjacent
        // sections; the section is kept shorter by its smaller cards instead.
        <section className="relative space-y-6 md:space-y-10">
            <HomeSectionHeader
                title="From Actors You Watch"
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
                            href="/settings?tab=radar"
                            title="Manage actors in Settings"
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-surface-2 text-fg-muted hover:bg-surface-4 hover:text-fg ring-2 ring-page transition-all shrink-0"
                        >
                            <Settings2 className="h-3.5 w-3.5" />
                        </Link>
                    </div>
                }
            />

            {payload.items.length === 0 ? (
                <p className="text-sm text-fg-dim py-4">
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
