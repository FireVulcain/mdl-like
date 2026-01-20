import { Badge } from "@/components/ui/badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { mediaService } from "@/services/media.service";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUserMedia } from "@/actions/user-media";
import { updateProgress } from "@/actions/media";
import { AddToListButton } from "@/components/add-to-list-button";
import { MediaCard } from "@/components/media-card";
import { SeasonSelector } from "@/components/season-selector";
import { PhotosScroll } from "@/components/media/photos-scroll";
import { CastScroll } from "@/components/media/cast-scroll";
import { TrailerButton } from "@/components/trailer-button";
import { NextEpisodeCountdown } from "@/components/next-episode-countdown";

// Mock User ID
const MOCK_USER_ID = "mock-user-1";

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
    const { id } = await params;
    const { season } = await searchParams;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    // Determine current season logic
    const selectedSeason = season ? parseInt(season) : 1;

    // Find metadata for this season (if available)
    const currentSeasonData = media.seasons?.find((s) => s.seasonNumber === selectedSeason);
    const episodeCount = currentSeasonData?.episodeCount || (selectedSeason === 1 ? media.totalEp : null) || null; // Fallback for movies or missing season data

    // Fetch user media specifically for this season
    const userMedia = await getUserMedia(MOCK_USER_ID, media.externalId, media.source, selectedSeason);

    // Determine update action if userMedia exists
    const updateAction = userMedia ? updateProgress.bind(null, userMedia.id) : undefined;

    return (
        <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-black -mt-24">
            {/* Backdrop */}
            <div className="relative h-[50vh] w-full overflow-hidden">
                {media.backdrop ? (
                    <>
                        <Image src={media.backdrop} alt={media.title} fill className="object-cover" priority />
                        {/* Top gradient for header readability on bright images */}
                        <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 via-black/30 to-transparent" />
                        {/* Overlay gradient for better text readability */}
                        <div className="absolute inset-0 bg-linear-to-t from-gray-900 via-gray-900/60 to-transparent" />
                        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-gray-900" />
                    </>
                ) : (
                    <div className="h-full w-full bg-linear-to-br from-gray-800 to-gray-900" />
                )}
            </div>

            <div className="container relative -top-20 z-10 grid gap-8 md:grid-cols-[300px_1fr] m-auto pb-20">
                {/* Poster & Actions */}
                <div className="space-y-4">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/10 hover:ring-white/20 transition-all">
                        {media.poster ? (
                            <Image src={media.poster} alt={media.title} fill className="object-cover" priority />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400">No Poster</div>
                        )}
                    </div>

                    <div
                        className="relative overflow-hidden rounded-xl border border-white/10 p-6 shadow-lg space-y-3"
                        style={{
                            background: "rgba(17, 24, 39, 0.6)",
                            backdropFilter: "blur(20px)",
                            boxShadow:
                                "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
                        }}
                    >
                        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                        <div className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2.5 text-sm">
                            <span className="text-gray-400 font-medium">Title</span>
                            <span className="text-white">{media.title}</span>

                            <span className="text-gray-400 font-medium">Type</span>
                            <span className="text-white">{media.type === "TV" ? "TV Show" : "Movie"}</span>

                            <span className="text-gray-400 font-medium">Country</span>
                            <span className="flex items-center gap-2">
                                <span className="text-white">{media.originCountry}</span>
                                <Badge variant="secondary" className="text-[10px] h-5 bg-white/10 text-gray-300 border-white/10">
                                    {media.originCountry}
                                </Badge>
                            </span>

                            {media.totalEp && (
                                <>
                                    <span className="text-gray-400 font-medium">Episodes</span>
                                    <span className="text-white">{media.totalEp}</span>
                                </>
                            )}

                            {media.aired && (
                                <>
                                    <span className="text-gray-400 font-medium">Aired</span>
                                    <span className="text-white">{media.aired}</span>
                                </>
                            )}

                            {media.network && (
                                <>
                                    <span className="text-gray-400 font-medium">Network</span>
                                    <span className="text-white">{media.network}</span>
                                </>
                            )}

                            {media.duration && (
                                <>
                                    <span className="text-gray-400 font-medium">Duration</span>
                                    <span className="text-white">{media.duration}</span>
                                </>
                            )}

                            {media.contentRating && (
                                <>
                                    <span className="text-gray-400 font-medium">Rating</span>
                                    <Badge variant="outline" className="w-fit bg-white/5 text-gray-300 border-white/20">
                                        {media.contentRating}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Next Episode Countdown (for ongoing TV shows) */}
                    {media.type === "TV" && (
                        <NextEpisodeCountdown
                            nextEpisode={media.nextEpisode}
                            currentSeason={currentSeasonData}
                            totalEpisodes={episodeCount ?? undefined}
                            status={media.status}
                            firstAirDate={media.firstAirDate}
                        />
                    )}
                </div>

                {/* Info */}
                <div className="pt-20 md:pt-0 space-y-8 min-w-0">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{media.title}</h1>
                        <div className="flex flex-wrap gap-2 text-muted-foreground items-center">
                            <span>{media.year}</span>
                            <span>•</span>
                            <Badge variant="outline">{media.originCountry}</Badge>
                            <span>•</span>
                            <span>{media.type}</span>
                            {media.rating > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="text-yellow-500 font-medium">★ {media.rating.toFixed(1)}</span>
                                </>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center gap-3 mt-5">
                            {media.trailer && <TrailerButton trailer={media.trailer} />}

                            {/* Season Selector (compact) */}
                            {media.type === "TV" && media.seasons && media.seasons.length > 1 && (
                                <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                            )}

                            <AddToListButton media={media} userMedia={userMedia} season={selectedSeason} totalEp={episodeCount} />

                            {/* Compact Progress Indicator */}
                            {userMedia && (
                                <div className="flex items-center px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
                                    <ProgressTracker
                                        current={userMedia.progress}
                                        total={episodeCount}
                                        status={userMedia.status}
                                        onUpdate={updateAction}
                                        compact
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="prose prose-invert max-w-none">
                        <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
                        <p className="leading-relaxed text-muted-foreground">{media.synopsis}</p>
                    </div>

                    {/* Cast & Credits */}
                    <CastScroll cast={media.cast || []} mediaId={media.id} />

                    {/* Photos */}
                    <PhotosScroll backdrops={media.images?.backdrops || []} mediaId={media.id} />

                    {/* Recommendations */}
                    {media.recommendations && media.recommendations.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                            <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-6">
                                {media.recommendations.map((item) => (
                                    <MediaCard key={item.id} media={item} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
