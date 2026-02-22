import { Badge } from "@/components/ui/badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { mediaService } from "@/services/media.service";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUserMedia, getWatchlistExternalIds } from "@/actions/user-media";
import { updateProgress } from "@/actions/media";
import { AddToListButton } from "@/components/add-to-list-button";
import { MediaCard } from "@/components/media-card";
import { SeasonSelector } from "@/components/season-selector";
import { PhotosScroll } from "@/components/media/photos-scroll";
import { CastScroll } from "@/components/media/cast-scroll";
import { MdlRatingBadge } from "@/components/media/mdl-rating-badge";
import { MdlRankRow } from "@/components/media/mdl-rank-row";
import { MdlSection } from "@/components/media/mdl-section";
import { TrailerButton } from "@/components/trailer-button";
import { NextEpisodeCountdown } from "@/components/next-episode-countdown";
import { EpisodeGuide } from "@/components/media/episode-guide";
import { Bookmark, ExternalLink } from "lucide-react";
import { tmdb, TMDB_CONFIG, TMDBEpisode } from "@/lib/tmdb";
import { Suspense } from "react";

// Mock User ID
const MOCK_USER_ID = "mock-user-1";

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
    // Parallel fetch: params and searchParams are independent
    const [{ id }, { season }] = await Promise.all([params, searchParams]);
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    // Determine current season logic
    const selectedSeason = season ? parseInt(season) : 1;

    // Find metadata for this season (if available)
    const currentSeasonData = media.seasons?.find((s) => s.seasonNumber === selectedSeason);
    const episodeCount = currentSeasonData?.episodeCount || (selectedSeason === 1 ? media.totalEp : null) || null; // Fallback for movies or missing season data

    // Fetch season episodes (TV only)
    let episodes: { id: number; number: number; name: string; overview: string; airDate: string | null; still: string | null; runtime: number | null; rating: number }[] = [];
    if (media.type === "TV") {
        try {
            const seasonData = await tmdb.getSeasonDetails(media.externalId, selectedSeason);
            episodes = (seasonData.episodes || []).map((ep: TMDBEpisode) => ({
                id: ep.id,
                number: ep.episode_number,
                name: ep.name,
                overview: ep.overview,
                airDate: ep.air_date,
                still: ep.still_path ? TMDB_CONFIG.w300Still(ep.still_path) : null,
                runtime: ep.runtime,
                rating: ep.vote_average,
            }));
        } catch {
            // Episodes unavailable — render guide without them
        }
    }

    // MDL is only relevant for Asian dramas (KR, CN, JP, TW, TH, HK)
    const MDL_COUNTRIES = new Set(["KR", "CN", "JP", "TW", "TH", "HK"]);
    const isMdlRelevant = MDL_COUNTRIES.has(media.originCountry);

    // Parallel fetch: userMedia and watchlist IDs — MDL streams in separately via Suspense
    const [userMedia, watchlistExternalIds] = await Promise.all([
        getUserMedia(MOCK_USER_ID, media.externalId, media.source, selectedSeason),
        getWatchlistExternalIds(),
    ]);
    const watchlistIds = new Set(watchlistExternalIds);

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
                            <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400">
                                No Poster
                            </div>
                        )}
                        <a
                            href={`https://mydramalist.com/search?q=${encodeURIComponent(media.title)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-[11px] font-medium text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                        >
                            <ExternalLink className="size-3" />
                            MDL
                        </a>
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

                            {isMdlRelevant && (
                                <Suspense fallback={
                                    <>
                                        <span className="text-gray-400 font-medium">MDL Rank</span>
                                        <span className="inline-block h-4 w-10 rounded bg-sky-500/20 animate-pulse" />
                                    </>
                                }>
                                    <MdlRankRow externalId={media.externalId} title={media.title} year={media.year} nativeTitle={media.nativeTitle} />
                                </Suspense>
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
                            {isMdlRelevant && (
                                <Suspense fallback={
                                    <>
                                        <span>•</span>
                                        <span className="inline-block h-4 w-14 rounded-md bg-sky-500/20 animate-pulse" />
                                    </>
                                }>
                                    <MdlRatingBadge externalId={media.externalId} title={media.title} year={media.year} nativeTitle={media.nativeTitle} />
                                </Suspense>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center gap-3 mt-5">
                            {media.trailer && <TrailerButton trailer={media.trailer} />}

                            {/* Season Selector (compact) */}
                            {media.type === "TV" && media.seasons && media.seasons.length > 1 && (
                                <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                            )}

                            <AddToListButton
                                // Only pass fields needed by client (server-serialization optimization)
                                media={{
                                    id: media.id,
                                    externalId: media.externalId,
                                    source: media.source,
                                    type: media.type,
                                    title: media.title,
                                    poster: media.poster,
                                    backdrop: media.backdrop,
                                    year: media.year,
                                    originCountry: media.originCountry,
                                    status: media.status,
                                    totalEp: media.totalEp,
                                    genres: media.genres,
                                    seasons: media.seasons?.map((s) => ({
                                        seasonNumber: s.seasonNumber,
                                        poster: s.poster,
                                        episodeCount: s.episodeCount,
                                        name: s.name,
                                        airDate: s.airDate,
                                    })),
                                    // Omit heavy unused fields: cast, images, recommendations, synopsis, rating, etc.
                                    synopsis: "",
                                    rating: 0,
                                }}
                                userMedia={userMedia}
                                season={selectedSeason}
                                totalEp={episodeCount}
                            />

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

                    {/* MDL Tags + Cast — streams in after TMDB cast (fallback) */}
                    {isMdlRelevant ? (
                        <Suspense fallback={
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                                    <span className="text-xs text-sky-400/60 animate-pulse">Fetching MDL data…</span>
                                </div>
                                <CastScroll cast={media.cast || []} mediaId={media.id} />
                            </div>
                        }>
                            <MdlSection
                                externalId={media.externalId}
                                title={media.title}
                                year={media.year}
                                nativeTitle={media.nativeTitle}
                                tmdbCast={media.cast || []}
                                mediaId={media.id}
                            />
                        </Suspense>
                    ) : (
                        <CastScroll cast={media.cast || []} mediaId={media.id} />
                    )}

                    {/* Episode Guide */}
                    {media.type === "TV" && episodes.length > 0 && (
                        <EpisodeGuide episodes={episodes} season={selectedSeason} poster={media.poster} />
                    )}

                    {/* Photos */}
                    <PhotosScroll backdrops={media.images?.backdrops || []} mediaId={media.id} />

                    {/* Recommendations */}
                    {media.recommendations && media.recommendations.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                            <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-6">
                                {media.recommendations.map((item) => (
                                    <MediaCard
                                        key={item.id}
                                        media={item}
                                        overlay={
                                            watchlistIds.has(item.externalId) ? (
                                                <div className="absolute bottom-2 left-2">
                                                    <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                                                        <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
                                                    </span>
                                                </div>
                                            ) : null
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
