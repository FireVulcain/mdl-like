import { Badge } from "@/components/ui/badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { mediaService } from "@/services/media.service";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUserMedia, getWatchlistExternalIds } from "@/actions/user-media";
import { updateProgress } from "@/actions/media";
import { AddToListButton } from "@/components/add-to-list-button";
import { SeasonSelector } from "@/components/season-selector";
import { PhotosScroll } from "@/components/media/photos-scroll";
import { CastScroll } from "@/components/media/cast-scroll";
import { MdlRatingBadge } from "@/components/media/mdl-rating-badge";
import { MdlRankRow } from "@/components/media/mdl-rank-row";
import { MdlSection } from "@/components/media/mdl-section";
import { TrailerButton } from "@/components/trailer-button";
import { NextEpisodeCountdown } from "@/components/next-episode-countdown";
import { EpisodeGuide } from "@/components/media/episode-guide";
import { MdlEpisodeGuideSection } from "@/components/media/mdl-episode-guide-section";
import { tmdb, TMDB_CONFIG, TMDBEpisode } from "@/lib/tmdb";
import { Suspense } from "react";
import { MdlRefetchButton } from "@/components/media/mdl-refetch-button";
import { MdlReviewsSection } from "@/components/media/mdl-reviews-section";
import { MdlThreadsSection } from "@/components/media/mdl-threads-section";
import { MdlRecommendationsSection } from "@/components/media/mdl-recommendations-section";
import { MdlPosterLink, MdlPosterLinkFallback } from "@/components/media/mdl-poster-link";
import { MediaNav, NavSection } from "@/components/media/media-nav";
import { WatchProvidersRow } from "@/components/media/watch-providers-row";
import { getCurrentUserId } from "@/lib/session";

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
    let episodes: {
        id: number;
        number: number;
        name: string;
        overview: string;
        airDate: string | null;
        still: string | null;
        runtime: number | null;
        rating: number;
    }[] = [];
    let seasonOverview: string | null = null;
    if (media.type === "TV") {
        try {
            const seasonData = await tmdb.getSeasonDetails(media.externalId, selectedSeason);
            seasonOverview = seasonData.overview || null;
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
    const [userId, watchlistExternalIds] = await Promise.all([getCurrentUserId(), getWatchlistExternalIds()]);
    const userMedia = await getUserMedia(userId, media.externalId, media.source, selectedSeason);
    const watchlistIds = new Set(watchlistExternalIds);

    // Determine update action if userMedia exists
    const updateAction = userMedia ? updateProgress.bind(null, userMedia.id) : undefined;

    return (
        <div className="min-h-screen bg-linear-to-b -mt-24">
            {/* Backdrop */}
            <div className="relative h-[50vh] w-full overflow-hidden">
                {media.backdrop ? (
                    <>
                        <Image
                            src={media.backdrop.replace("/t/p/w1280/", "/t/p/original/")}
                            alt={media.title}
                            fill
                            className="object-cover"
                            priority
                        />
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

            <div className="container relative -top-20 z-10 grid gap-8 md:grid-cols-[300px_1fr] m-auto pb-20 px-4 md:px-6">
                {/* Poster & Actions */}
                <div className="space-y-4">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/10 hover:ring-white/20 transition-all">
                        {currentSeasonData?.poster || media.poster ? (
                            <Image src={currentSeasonData?.poster ?? media.poster!} alt={media.title} fill className="object-cover" priority />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400">
                                No Poster
                            </div>
                        )}
                        {isMdlRelevant && (
                            <Suspense fallback={<MdlPosterLinkFallback title={media.title} />}>
                                <MdlPosterLink
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    season={selectedSeason}
                                />
                            </Suspense>
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

                            {isMdlRelevant && (
                                <Suspense
                                    fallback={
                                        <>
                                            <span className="text-gray-400 font-medium">MDL Rank</span>
                                            <span className="inline-block h-4 w-10 rounded bg-sky-500/20 animate-pulse" />
                                        </>
                                    }
                                >
                                    <MdlRankRow
                                        externalId={media.externalId}
                                        title={media.title}
                                        year={media.year}
                                        nativeTitle={media.nativeTitle}
                                        season={selectedSeason}
                                    />
                                </Suspense>
                            )}

                            <Suspense fallback={null}>
                                <WatchProvidersRow type={media.type === "TV" ? "tv" : "movie"} id={media.externalId} />
                            </Suspense>
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
                        <h1 className="text-4xl font-bold mb-2 flex items-baseline gap-2">
                            <span>{media.title}</span>
                            {media.type === "TV" && media.seasons && media.seasons.length > 1 && (
                                <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                            )}
                        </h1>
                        <div className="flex flex-wrap gap-2 text-muted-foreground items-center">
                            <span>{media.year}</span>
                            <span>•</span>
                            <Badge variant="outline">{media.originCountry}</Badge>
                            <span>•</span>
                            <span>{media.type}</span>
                            {media.type === "TV" && episodeCount && (
                                <>
                                    <span>•</span>
                                    <span>{episodeCount} eps</span>
                                </>
                            )}
                            {media.rating > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="text-yellow-500 font-medium">★ {media.rating.toFixed(1)}</span>
                                </>
                            )}
                            {isMdlRelevant && (
                                <>
                                    <Suspense
                                        fallback={
                                            <>
                                                <span>•</span>
                                                <span className="inline-block h-4 w-14 rounded-md bg-sky-500/20 animate-pulse" />
                                            </>
                                        }
                                    >
                                        <MdlRatingBadge
                                            externalId={media.externalId}
                                            title={media.title}
                                            year={media.year}
                                            nativeTitle={media.nativeTitle}
                                            season={selectedSeason}
                                        />
                                    </Suspense>
                                    <MdlRefetchButton tmdbExternalId={media.externalId} mediaId={media.id} />
                                </>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-wrap items-center gap-3 mt-5">
                            {media.trailer && <TrailerButton trailer={media.trailer} />}

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

                    {/* In-page navigation */}
                    {(() => {
                        const navSections: NavSection[] = [
                            { id: "section-cast", label: "Cast & Credits" },
                            ...(media.type === "TV" && episodes.length > 0 ? [{ id: "section-episodes", label: "Episode Guide" }] : []),
                            ...((media.images?.backdrops?.length ?? 0) > 0 ? [{ id: "section-photos", label: "Photos" }] : []),
                            ...(isMdlRelevant ? [{ id: "section-reviews", label: "Reviews" }] : []),
                            { id: "section-recommendations", label: "Recommendations" },
                            ...(isMdlRelevant ? [{ id: "section-comments", label: "Comments" }] : []),
                        ];
                        return <MediaNav sections={navSections} />;
                    })()}

                    <div className="prose prose-invert max-w-none">
                        <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
                        <p className="leading-relaxed text-muted-foreground">{seasonOverview || media.synopsis}</p>
                    </div>

                    {/* MDL Tags + Cast — streams in after TMDB cast (fallback) */}
                    <div id="section-cast">
                        {isMdlRelevant ? (
                            <Suspense
                                fallback={
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                                            <span className="text-xs text-sky-400/60 animate-pulse">Fetching MDL data…</span>
                                        </div>
                                        <CastScroll cast={media.cast || []} mediaId={media.id} />
                                    </div>
                                }
                            >
                                <MdlSection
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    tmdbCast={media.cast || []}
                                    mediaId={media.id}
                                    season={selectedSeason}
                                />
                            </Suspense>
                        ) : (
                            <CastScroll cast={media.cast || []} mediaId={media.id} />
                        )}
                    </div>

                    {/* Episode Guide */}
                    {media.type === "TV" && episodes.length > 0 && (
                        <div id="section-episodes">
                            {isMdlRelevant ? (
                                <Suspense fallback={<EpisodeGuide episodes={episodes} season={selectedSeason} poster={media.poster} />}>
                                    <MdlEpisodeGuideSection
                                        tmdbEpisodes={episodes}
                                        season={selectedSeason}
                                        poster={media.poster}
                                        externalId={media.externalId}
                                        mediaId={media.id}
                                        title={media.title}
                                    />
                                </Suspense>
                            ) : (
                                <EpisodeGuide episodes={episodes} season={selectedSeason} poster={media.poster} />
                            )}
                        </div>
                    )}

                    {/* Photos */}
                    <div id="section-photos">
                        <PhotosScroll backdrops={media.images?.backdrops || []} mediaId={media.id} />
                    </div>

                    {/* MDL Reviews */}
                    {isMdlRelevant && (
                        <div id="section-reviews">
                            <Suspense fallback={null}>
                                <MdlReviewsSection
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    mediaId={media.id}
                                />
                            </Suspense>
                        </div>
                    )}

                    {/* Recommendations */}
                    <div id="section-recommendations">
                        <Suspense fallback={<div className="h-6 w-40 rounded bg-white/5 animate-pulse mb-4" />}>
                            <MdlRecommendationsSection
                                tmdbRecs={media.recommendations || []}
                                externalId={media.externalId}
                                season={selectedSeason}
                                watchlistIds={watchlistExternalIds}
                            />
                        </Suspense>
                    </div>

                    {/* MDL Comments */}
                    {isMdlRelevant && (
                        <div id="section-comments">
                            <Suspense fallback={null}>
                                <MdlThreadsSection
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    season={selectedSeason}
                                />
                            </Suspense>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
