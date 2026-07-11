import Image from "next/image";
import { getActorRadar, type ActorRadarItem } from "@/actions/actor-radar";
import type { UnifiedMedia } from "@/services/media.service";
import { MediaCard } from "@/components/media-card";
import { ActorRadarManage } from "@/components/actor-radar-manage";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { UserRound } from "lucide-react";

function toUnifiedMedia(item: ActorRadarItem): UnifiedMedia {
    return {
        id: `mdl-${item.slug}`,
        externalId: item.mdlId,
        source: "MDL",
        type: item.mediaType,
        title: item.title,
        poster: item.poster,
        backdrop: null,
        year: String(item.year),
        originCountry: "",
        synopsis: "",
        rating: item.rating,
    };
}

function ActorChip({ item }: { item: ActorRadarItem }) {
    const first = item.actors[0];
    if (!first) return null;
    return (
        <div className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)]">
            <span className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-black/70 backdrop-blur-sm">
                {first.profileImage ? (
                    <Image
                        unoptimized
                        src={first.profileImage}
                        alt={first.name}
                        width={18}
                        height={18}
                        className="h-4.5 w-4.5 rounded-full object-cover"
                    />
                ) : (
                    <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white/10">
                        <UserRound className="h-3 w-3 text-gray-300" />
                    </span>
                )}
                <span className="text-[10px] font-medium text-violet-200 truncate">
                    {first.name}
                    {item.actors.length > 1 && <span className="text-gray-400"> +{item.actors.length - 1}</span>}
                </span>
            </span>
        </div>
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
        <section className="relative space-y-6 md:space-y-8 bg-white/2 backdrop-blur-sm p-4 md:p-8 rounded-xl border border-white/5 shadow-lg overflow-hidden">
            {/* Atmospheric Background Effects */}
            <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-violet-500/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-48 md:w-96 h-48 md:h-96 bg-fuchsia-600/8 rounded-full blur-[80px] md:blur-[120px] -z-10" />
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 md:space-y-2">
                    <h2 className="text-xl md:text-3xl font-bold text-white">From Actors You Watch</h2>
                    <p className="text-xs md:text-sm text-gray-400">New and upcoming titles starring your favorites</p>
                </div>
                <div className="flex items-center -space-x-2 shrink-0">
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
                    <ActorRadarManage scannedActors={payload.scannedActors} excludedActors={payload.excludedActors} />
                </div>
            </div>

            {payload.items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">
                    Nothing on the radar — restore removed actors via the manage button above.
                </p>
            ) : (
            <ScrollArea className="w-full whitespace-nowrap -mx-2 md:-mx-4 px-2 md:px-4" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 md:gap-6 py-3 md:py-4 px-3 md:px-4">
                    {payload.items.map((item) => {
                        const href = item.tmdbId
                            ? `/media/tmdb-${item.tmdbId}${item.season && item.season > 1 ? `?season=${item.season}` : ""}`
                            : `/media/mdl-${item.slug}`;
                        return (
                            <div key={item.mdlId} className="w-32 sm:w-40 md:w-55 shrink-0 transition-transform hover:scale-105 duration-300">
                                <MediaCard
                                    media={toUnifiedMedia(item)}
                                    href={href}
                                    overlay={
                                        <>
                                            <ActorChip item={item} />
                                            {!item.tmdbId && (
                                                <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <LinkToTmdbButton mdlSlug={item.slug} defaultQuery={item.title} compact />
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            </div>
                        );
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="opacity-50" />
            </ScrollArea>
            )}
        </section>
    );
}
