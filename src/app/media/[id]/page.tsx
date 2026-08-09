import Link from "next/link";
import { ExternalLink, Link2 } from "lucide-react";
import { mediaService } from "@/services/media.service";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUserMedia, getWatchlistExternalIds } from "@/actions/user-media";
import { getViewPreferences, getDisplayPreferences } from "@/actions/preferences";
import { AddToListButton } from "@/components/add-to-list-button";
import { SeasonSelector } from "@/components/season-selector";
import { PhotosScroll } from "@/components/media/photos-scroll";
import { CastScroll } from "@/components/media/cast-scroll";
import { MdlRatingBadge } from "@/components/media/mdl-rating-badge";
import { MdlRankRow } from "@/components/media/mdl-rank-row";
import { MdlAiredRow } from "@/components/media/mdl-aired-row";
import { MdlLiveRefresh } from "@/components/media/mdl-live-refresh";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { MdlSection } from "@/components/media/mdl-section";
import { SynopsisBlock } from "@/components/media/synopsis-block";
import { TrailerButton } from "@/components/trailer-button";
import { NextEpisodeCountdown } from "@/components/next-episode-countdown";
import { EpisodeGuide } from "@/components/media/episode-guide";
import { MdlEpisodeGuideSection } from "@/components/media/mdl-episode-guide-section";
import { tmdb, TMDB_CONFIG, TMDBEpisode } from "@/lib/tmdb";
import { kuryanaGetCast, kuryanaGetNextEpisode, type MdlNextEpisode } from "@/lib/kuryana";
import { MdlCast } from "@/lib/mdl-data";
import { MdlCastScroll } from "@/components/media/mdl-cast-scroll";
import { Suspense } from "react";
import { MdlReviewsSection } from "@/components/media/mdl-reviews-section";
import { MdlThreadsSection } from "@/components/media/mdl-threads-section";
import { MdlRecsSection } from "@/components/media/mdl-recommendations-section";
import { MdlPosterLink, MdlPosterLinkFallback } from "@/components/media/mdl-poster-link";
import { prisma } from "@/lib/prisma";
import { MediaNav, NavSection } from "@/components/media/media-nav";
import { WatchProvidersRow } from "@/components/media/watch-providers-row";
import { getCurrentUserId } from "@/lib/session";
import { MdlLinkEditor } from "@/components/media/mdl-link-editor";
import { MdlSeasonLinkButton } from "@/components/media/mdl-season-link-button";
import { StickySidebar } from "@/components/media/sticky-sidebar";
import { MetaLinkList, GENRE_LIST, TAG_LIST } from "@/components/media/meta-link-list";

// MDL's next-episode data (exact broadcast time) mapped to the countdown's shape;
// TVmaze/TMDB data stays as fallback when MDL doesn't know the next episode.
function toCountdownEpisode(mdlNext: MdlNextEpisode | null, season: number) {
    if (!mdlNext) return null;
    return {
        airDate: mdlNext.airDate,
        airDateTime: mdlNext.airDateTime,
        episodeNumber: mdlNext.episodeNumber,
        seasonNumber: season,
        name: "",
        seasonEpisodeCount: mdlNext.totalEpisodes ?? undefined,
    };
}

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
    // Parallel fetch: params and searchParams are independent
    const [{ id }, { season }] = await Promise.all([params, searchParams]);
    const [media, viewPrefs, displayPrefs] = await Promise.all([mediaService.getDetails(id), getViewPreferences(), getDisplayPreferences()]);

    if (!media) {
        notFound();
    }

    // Spoiler-free mode: never surface upcoming episode names
    const spoilerSafe = <T extends { name?: string } | null | undefined>(ep: T): T =>
        ep && displayPrefs.hideSpoilers ? { ...ep, name: "" } : ep;

    // Hero title only — watchlist entries and TVmaze/MDL matching keep the english title
    const displayTitle = displayPrefs.titleLanguage === "native" && media.nativeTitle ? media.nativeTitle : media.title;

    // The other title, shown under the main one the way MDL does it. Which one
    // that is follows the display preference, so it never repeats the heading —
    // and it's dropped entirely when both titles are the same string.
    const otherTitle = displayTitle === media.title ? media.nativeTitle : media.title;
    const secondaryTitle = otherTitle && otherTitle !== displayTitle ? otherTitle : null;

    // MDL-native page: data already comes from Kuryana, skip all TMDB-specific fetches
    if (media.source === "MDL") {
        // A slug reaches TMDB through any of three tables, the same set /dramas
        // consults: the show-level cache, a season link (S2+), or an alias
        // (Part 1 / Part 2 split). Reading only the first made season- and
        // alias-linked entries look unlinked on their own page.
        const [userId, watchlistExternalIds, castResult, showLink, seasonLink, aliasLink] = await Promise.all([
            getCurrentUserId(),
            getWatchlistExternalIds(),
            kuryanaGetCast(media.externalId),
            prisma.cachedMdlData.findFirst({
                where: { mdlSlug: media.externalId },
                select: { tmdbExternalId: true },
            }),
            prisma.mdlSeasonLink.findFirst({
                where: { mdlSlug: media.externalId },
                select: { tmdbExternalId: true, season: true },
            }),
            prisma.mdlAlias.findUnique({
                where: { mdlSlug: media.externalId },
                select: { tmdbExternalId: true },
            }),
        ]);
        const linkedTmdb = showLink ?? seasonLink ?? aliasLink;
        const linkedSeason = seasonLink?.season;
        const linkedHref = linkedTmdb
            ? `/media/tmdb-${linkedTmdb.tmdbExternalId}${linkedSeason && linkedSeason > 1 ? `?season=${linkedSeason}` : ""}`
            : null;
        // Check TMDB entry first (if linked), fall back to MDL entry in case user added it before the link existed
        const userMedia =
            (await getUserMedia(userId, linkedTmdb?.tmdbExternalId ?? media.externalId, linkedTmdb ? "TMDB" : "MDL", 1)) ??
            (linkedTmdb?.tmdbExternalId ? await getUserMedia(userId, media.externalId, "MDL", 1) : null);

        // MDL knows the exact next-episode broadcast time (cached 1h by the details fetch)
        const mdlNextEpisode = media.type === "TV" ? await kuryanaGetNextEpisode(media.externalId) : null;

        // A poster hand-picked in the watchlist wins over the auto-selected one
        const displayPoster = userMedia?.poster ?? media.poster;

        // Convert KuryanaCastResult to MdlCast grouped format
        const mdlCast: MdlCast = { main: [], support: [], guest: [], cameo: [] };
        if (castResult?.data?.casts) {
            const roles = castResult.data.casts;
            const normalize = (members: (typeof roles)["Main Role"]) =>
                (members ?? []).map((m) => ({
                    name: m.name,
                    profileImage: m.profile_image ?? "",
                    slug: m.slug,
                    characterName: m.role?.name ?? "",
                    roleType: m.role?.type ?? ("Support Role" as const),
                }));
            mdlCast.main = normalize(roles["Main Role"]);
            mdlCast.support = normalize(roles["Support Role"]);
            mdlCast.guest = normalize(roles["Guest Role"]);
            mdlCast.cameo = normalize(roles["Cameo"]);
        }

        const navSections: NavSection[] = [
            { id: "section-cast", label: "Cast" },
            ...(media.type === "TV" ? [{ id: "section-episodes", label: "Episodes" }] : []),
            { id: "section-reviews", label: "Reviews" },
            { id: "section-recommendations", label: "Recs" },
            { id: "section-comments", label: "Comments" },
        ];

        return (
            <div className="min-h-screen bg-linear-to-b -mt-24">
                <div className="relative h-[25vh] min-h-44 w-full overflow-hidden">
                    <div className="h-full w-full bg-linear-to-br from-gray-800 to-gray-900" />
                </div>

                <div className="container relative -top-20 z-10 md:grid md:gap-8 md:grid-cols-[300px_1fr] m-auto pb-20 px-4 md:px-6">
                    {/* Mobile header: poster + title/metadata/action */}
                    <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                        <div className="relative aspect-2/3 overflow-hidden rounded-lg">
                            {displayPoster ? (
                                <Image unoptimized src={displayPoster} alt={media.title} fill className="object-cover" priority />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400 text-xs">No Poster</div>
                            )}
                            <a
                                href={`https://mydramalist.com/${media.externalId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-medium text-white/70"
                            >
                                <ExternalLink className="size-2.5" />
                                MDL
                            </a>
                        </div>
                        <div className="flex flex-col gap-2 min-w-0 py-0.5">
                            <div className="space-y-1">
                                <h1 className="text-base font-bold leading-snug">{displayTitle}</h1>
                                {secondaryTitle && <p className="text-xs text-muted-foreground leading-snug">{secondaryTitle}</p>}
                                <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-muted-foreground items-center">
                                    <span>{media.originCountry}</span>
                                    <span>{media.year}</span>
                                    <span>•</span>
                                    <span>{media.type === "TV" ? "TV Show" : "Movie"}</span>
                                    {media.totalEp && <><span>•</span><span>{media.totalEp} eps</span></>}
                                    {media.rating > 0 && <span className="text-sky-400 font-semibold">MDL {media.rating.toFixed(1)}</span>}
                                </div>
                            </div>
                            <AddToListButton defaultStatus={viewPrefs.defaultAddStatus}
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
                                    synopsis: "",
                                    rating: 0,
                                }}
                                userMedia={userMedia}
                                season={1}
                                totalEp={media.totalEp ?? null}
                                className="w-full justify-center"
                            />
                        </div>
                    </div>
                    <div className="hidden md:block">
                    <StickySidebar>
                        <div className="relative aspect-2/3 overflow-hidden rounded-lg">
                            {displayPoster ? (
                                <Image unoptimized src={displayPoster} alt={media.title} fill className="object-cover" priority />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400">
                                    No Poster
                                </div>
                            )}
                            <a
                                href={`https://mydramalist.com/${media.externalId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10 text-xs font-medium text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                            >
                                <ExternalLink className="size-3" />
                                MDL
                            </a>
                        </div>

                        <AddToListButton defaultStatus={viewPrefs.defaultAddStatus}
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
                                synopsis: "",
                                rating: 0,
                            }}
                            userMedia={userMedia}
                            season={1}
                            totalEp={media.totalEp ?? null}
                            className="w-full justify-center"
                        />

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

                                {/* The code was printed twice, once plain and once
                                    in a badge right beside it */}
                                <span className="text-gray-400 font-medium">Country</span>
                                <span className="text-white">{media.originCountry}</span>

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

                                {media.rating > 0 && (
                                    <>
                                        <span className="text-gray-400 font-medium">MDL Score</span>
                                        <span className="text-sky-400 font-medium">MDL {media.rating.toFixed(1)}</span>
                                    </>
                                )}

                                {media.mdlRanking && (
                                    <>
                                        <span className="text-gray-400 font-medium">MDL Rank</span>
                                        <span className="text-sky-400 font-medium">{media.mdlRanking}</span>
                                    </>
                                )}

                                {media.mdlWatchers ? (
                                    <>
                                        <span className="text-gray-400 font-medium">Watchers</span>
                                        {/* Explicit locale: the server's own would group with spaces */}
                                        <span className="text-white">{media.mdlWatchers.toLocaleString("en-US")}</span>
                                    </>
                                ) : null}
                            </div>
                        </div>

                        {media.type === "TV" && (mdlNextEpisode || media.nextEpisode) && (
                            <NextEpisodeCountdown
                                nextEpisode={toCountdownEpisode(mdlNextEpisode, 1) ?? spoilerSafe(media.nextEpisode)}
                                totalEpisodes={media.totalEp}
                            />
                        )}
                    </StickySidebar>
                    </div>

                    <div className="space-y-8 min-w-0 md:pt-20">
                        <div className="hidden md:block">
                            <h1 className="font-display text-4xl font-semibold">{displayTitle}</h1>
                            {secondaryTitle && <p className="mt-1 text-lg text-muted-foreground">{secondaryTitle}</p>}
                            <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground items-center">
                                <span>{media.year}</span>
                                <span>•</span>
                                <span>{media.originCountry}</span>
                                <span>•</span>
                                <span>{media.type}</span>
                                {media.totalEp && (
                                    <>
                                        <span>•</span>
                                        <span>{media.totalEp} eps</span>
                                    </>
                                )}
                                {media.rating > 0 && (
                                    <>
                                        <span>•</span>
                                        <span className="text-sky-400 font-medium">MDL {media.rating.toFixed(1)}</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* TMDB bridge. Deliberately never a redirect — landing here is
                            allowed, we just say where the richer page is. Unlinked, this
                            is the one screen with enough context (synopsis, cast, year)
                            to match the show confidently. */}
                        {linkedHref ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <Link2 className="h-4 w-4 shrink-0 text-sky-400" />
                                <span className="text-gray-300">
                                    This drama is linked to a TMDB entry
                                    {linkedSeason && linkedSeason > 1 ? ` (season ${linkedSeason})` : ""}.
                                </span>
                                <Link href={linkedHref} className="font-medium text-sky-400 hover:text-sky-300 transition-colors">
                                    Open the full page →
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                                <Link2 className="h-4 w-4 shrink-0 text-gray-500" />
                                <span className="text-gray-400">Not linked to TMDB yet — linking unlocks the full page.</span>
                                <LinkToTmdbButton mdlSlug={media.externalId} defaultQuery={media.title} />
                            </div>
                        )}

                        {(media.aired || media.network || media.duration) && (
                            <div className="md:hidden grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5 text-sm">
                                {media.aired && (
                                    <>
                                        <span className="text-gray-400">Aired</span>
                                        <span className="text-white">{media.aired}</span>
                                    </>
                                )}
                                {media.network && (
                                    <>
                                        <span className="text-gray-400">Network</span>
                                        <span className="text-white">{media.network}</span>
                                    </>
                                )}
                                {media.duration && (
                                    <>
                                        <span className="text-gray-400">Duration</span>
                                        <span className="text-white">{media.duration}</span>
                                    </>
                                )}
                            </div>
                        )}

                        <MediaNav sections={navSections} />

                        <div id="section-cast" className="space-y-4">
                            <SynopsisBlock text={media.synopsis || ""} />
                            {media.genres && media.genres.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="font-display text-lg font-semibold mb-2">Genres</h3>
                                    <MetaLinkList
                                        {...GENRE_LIST}
                                        items={media.genres.map((g) => ({
                                            key: g,
                                            label: g,
                                            href: `/dramas?genre=${encodeURIComponent(g)}`,
                                        }))}
                                    />
                                </div>
                            )}
                            {media.tags && media.tags.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="font-display text-lg font-semibold mb-2">Tags</h3>
                                    <MetaLinkList
                                        {...TAG_LIST}
                                        items={media.tags.map((t) => ({
                                            key: String(t.id),
                                            label: t.name,
                                            href: `/dramas?tag=${t.id}&tag_name=${encodeURIComponent(t.name)}`,
                                        }))}
                                    />
                                </div>
                            )}
                            <div className="mt-2">
                                <MdlCastScroll cast={mdlCast} tmdbCast={[]} mediaId={media.id} />
                            </div>
                        </div>

                        {media.type === "TV" && (
                            <div id="section-episodes" className="border-t border-white/8 pt-8">
                                <Suspense fallback={<EpisodeGuide episodes={[]} season={1} poster={media.poster} />}>
                                    <MdlEpisodeGuideSection
                                        tmdbEpisodes={[]}
                                        season={1}
                                        poster={media.poster}
                                        externalId={media.externalId}
                                        mdlSlug={media.externalId}
                                        mediaId={id}
                                        watchedProgress={userMedia?.progress}
                                        hideSpoilers={displayPrefs.hideSpoilers}
                                    />
                                </Suspense>
                            </div>
                        )}

                        <div id="section-reviews" className="border-t border-white/8 pt-8">
                            <Suspense fallback={null}>
                                <MdlReviewsSection
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    mediaId={media.id}
                                    mdlSlug={media.externalId}
                                />
                            </Suspense>
                        </div>

                        <div id="section-recommendations" className="border-t border-white/8 pt-8">
                            <Suspense fallback={<div className="h-6 w-40 rounded bg-white/5 animate-pulse mb-4" />}>
                                <MdlRecsSection
                                    tmdbRecs={[]}
                                    externalId={media.externalId}
                                    season={1}
                                    watchlistIds={watchlistExternalIds}
                                    mdlSlug={media.externalId}
                                />
                            </Suspense>
                        </div>

                        <div id="section-comments" className="border-t border-white/8 pt-8">
                            <Suspense fallback={null}>
                                <MdlThreadsSection externalId={media.externalId} title={media.title} year={media.year} mdlSlug={media.externalId} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        );
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
    const MDL_COUNTRIES = new Set(["KR", "CN", "JP", "TW", "TH", "HK", "US"]);
    const isMdlRelevant = MDL_COUNTRIES.has(media.originCountry);

    // Parallel fetch: userMedia and watchlist IDs — MDL streams in separately via Suspense
    const [userId, watchlistExternalIds, cached, existingSeasonLink] = await Promise.all([
        getCurrentUserId(),
        getWatchlistExternalIds(),
        isMdlRelevant
            ? prisma.cachedMdlData.findUnique({ where: { tmdbExternalId: media.externalId }, select: { mdlSlug: true, mdlRating: true, mdlDisabled: true } })
            : null,
        isMdlRelevant && selectedSeason > 1
            ? prisma.mdlSeasonLink.findUnique({
                  where: { tmdbExternalId_season: { tmdbExternalId: media.externalId, season: selectedSeason } },
                  select: { mdlSlug: true, mdlRating: true },
              })
            : null,
    ]);
    const showSeasonLinkButton = isMdlRelevant && selectedSeason > 1 && !!cached?.mdlSlug && !existingSeasonLink;
    const hasMdlRating = !cached?.mdlDisabled && !!(existingSeasonLink?.mdlRating ?? cached?.mdlRating);
    // Blocking a show hides its MDL surface. The poster link needed its own
    // check: with no slug it degrades to an MDL *search* URL, so a blocked show
    // still offered a way over to MDL — and its Suspense fallback rendered that
    // search link unconditionally, before any lookup had even run.
    const showMdlPosterLink = isMdlRelevant && !cached?.mdlDisabled;
    // If no TMDB watchlist entry, fall back to the linked MDL entry (user may have added via MDL page)
    const userMedia =
        (await getUserMedia(userId, media.externalId, media.source, selectedSeason)) ??
        (cached?.mdlSlug && !cached.mdlDisabled
            ? await getUserMedia(userId, cached.mdlSlug, "MDL", selectedSeason)
            : null);

    // MDL knows the exact next-episode broadcast time — prefer it over TVmaze/TMDB.
    // Season links map per season; the show-level slug only stands for season 1.
    const mdlSlugForSeason =
        existingSeasonLink?.mdlSlug ??
        (selectedSeason <= 1 && cached?.mdlSlug && !cached.mdlDisabled ? cached.mdlSlug : null);
    const mdlNextEpisode = media.type === "TV" && mdlSlugForSeason ? await kuryanaGetNextEpisode(mdlSlugForSeason) : null;

    // Images hand-picked in the watchlist win over the auto-selected ones. The row's
    // backdrop only counts when it differs from its poster — addToWatchlist falls back
    // to the poster when a show has no backdrop, and that must not become the hero.
    const displayPoster = userMedia?.poster ?? currentSeasonData?.poster ?? media.poster;
    const heroBackdrop =
        (userMedia?.backdrop && userMedia.backdrop !== userMedia.poster ? userMedia.backdrop : null) ?? media.backdrop;
    const watchlistIds = new Set(watchlistExternalIds);

    // Determine update action if userMedia exists

    return (
        <div className="min-h-screen bg-linear-to-b -mt-24">
            {/* Renders nothing: re-reads MDL's volatile numbers once the page is
                on screen, and re-renders only if one of them moved. */}
            <MdlLiveRefresh externalId={media.externalId} season={selectedSeason} />

            {/* Backdrop */}
            <div className="relative h-[25vh] min-h-44 w-full overflow-hidden">
                {heroBackdrop ? (
                    <>
                        <Image
                            unoptimized={true}
                            src={heroBackdrop.replace("/t/p/w1280/", "/t/p/original/")}
                            alt={media.title}
                            fill
                            className="object-cover"
                            priority
                        />
                        {/* Top gradient for header readability on bright images */}
                        {/* One gradient, not three. A top scrim for the header, a
                            bottom fade to the page, and a third that repeated the
                            second's job were stacked here — the same pile the hero
                            carried. This single stop does both ends. */}
                        <div className="absolute inset-0 bg-linear-to-b from-black/60 via-transparent to-gray-900" />
                    </>
                ) : (
                    <div className="h-full w-full bg-linear-to-br from-gray-800 to-gray-900" />
                )}
            </div>

            <div className="container relative -top-20 z-10 md:grid md:gap-8 md:grid-cols-[300px_1fr] m-auto pb-20 px-4 md:px-6">
                {/* Mobile header: poster + title/metadata/action */}
                <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                    <div className="relative aspect-2/3 overflow-hidden rounded-lg">
                        {displayPoster ? (
                            <Image unoptimized src={displayPoster} alt={media.title} fill className="object-cover" priority />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400 text-xs">No Poster</div>
                        )}
                        {showMdlPosterLink && (
                            <Suspense fallback={<MdlPosterLinkFallback title={media.title} />}>
                                <MdlPosterLink externalId={media.externalId} title={media.title} year={media.year} nativeTitle={media.nativeTitle} season={selectedSeason} />
                            </Suspense>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-0 py-0.5">
                        <div className="space-y-1">
                            <h1 className="text-base font-bold leading-snug flex items-baseline gap-1.5 flex-wrap">
                                <span>{displayTitle}</span>
                                {media.type === "TV" && media.seasons && media.seasons.length > 1 && (
                                    <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                                )}
                            </h1>
                            {secondaryTitle && <p className="text-xs text-muted-foreground leading-snug">{secondaryTitle}</p>}
                            <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-muted-foreground items-center">
                                <span>{media.originCountry}</span>
                                <span>{media.year}</span>
                                <span>•</span>
                                <span>{media.type === "TV" ? "TV Show" : "Movie"}</span>
                                {media.type === "TV" && episodeCount && <><span>•</span><span>{episodeCount} eps</span></>}
                                {media.rating > 0 && !hasMdlRating && <span className="text-yellow-400 font-semibold">★ {media.rating.toFixed(1)}</span>}
                                {isMdlRelevant && (
                                    <Suspense fallback={<span className="inline-block h-3.5 w-10 rounded bg-sky-500/20 animate-pulse" />}>
                                        <MdlRatingBadge
                                            externalId={media.externalId}
                                            title={media.title}
                                            year={media.year}
                                            nativeTitle={media.nativeTitle}
                                            season={selectedSeason}
                                        />
                                    </Suspense>
                                )}
                            </div>
                        </div>
                        <AddToListButton defaultStatus={viewPrefs.defaultAddStatus}
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
                                synopsis: "",
                                rating: 0,
                            }}
                            userMedia={userMedia}
                            season={selectedSeason}
                            totalEp={episodeCount}
                            className="w-full justify-center"
                        />
                        {media.trailer && <TrailerButton trailer={media.trailer} className="w-full justify-center" />}
                    </div>
                </div>
                {/* Poster & Actions */}
                <div className="hidden md:block">
                <StickySidebar>
                    <div className="relative aspect-2/3 overflow-hidden rounded-lg">
                        {displayPoster ? (
                            <Image
                                unoptimized={true}
                                src={displayPoster}
                                alt={media.title}
                                fill
                                className="object-cover"
                                priority
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400">
                                No Poster
                            </div>
                        )}
                        {showMdlPosterLink && (
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

                    <AddToListButton defaultStatus={viewPrefs.defaultAddStatus}
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
                            synopsis: "",
                            rating: 0,
                        }}
                        userMedia={userMedia}
                        season={selectedSeason}
                        totalEp={episodeCount}
                        className="w-full justify-center"
                    />
                    {media.trailer && <TrailerButton trailer={media.trailer} className="w-full justify-center" />}

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
                            <span className="text-white">{media.originCountry}</span>

                            {media.totalEp && (
                                <>
                                    <span className="text-gray-400 font-medium">Episodes</span>
                                    <span className="text-white">{media.totalEp}</span>
                                </>
                            )}

                            <Suspense
                                fallback={
                                    <>
                                        <span className="text-gray-400 font-medium">Aired</span>
                                        <span className="text-white">{media.aired}</span>
                                    </>
                                }
                            >
                                <MdlAiredRow
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    season={selectedSeason}
                                    fallback={media.aired}
                                />
                            </Suspense>

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
                                    <span className="text-gray-300">{media.contentRating}</span>
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
                            nextEpisode={toCountdownEpisode(mdlNextEpisode, selectedSeason) ?? spoilerSafe(media.nextEpisode)}
                            currentSeason={currentSeasonData}
                            totalEpisodes={episodeCount ?? undefined}
                            status={media.status}
                            firstAirDate={media.firstAirDate}
                        />
                    )}
                </StickySidebar>
                </div>

                {/* Info */}
                <div className="space-y-8 min-w-0 md:pt-20">
                    <div className="hidden md:block">
                        <h1 className="font-display text-4xl font-semibold flex items-baseline gap-2">
                            <span>{displayTitle}</span>
                            {media.type === "TV" && media.seasons && media.seasons.length > 1 && (
                                <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                            )}
                        </h1>
                        {secondaryTitle && <p className="mt-1 text-lg text-muted-foreground">{secondaryTitle}</p>}
                        <div className="mt-2 flex flex-wrap gap-2 text-muted-foreground items-center">
                            <span>{media.year}</span>
                            <span>•</span>
                            <span>{media.originCountry}</span>
                            <span>•</span>
                            <span>{media.type}</span>
                            {media.type === "TV" && episodeCount && (
                                <>
                                    <span>•</span>
                                    <span>{episodeCount} eps</span>
                                </>
                            )}
                            {media.rating > 0 && !hasMdlRating && (
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
                                    {showSeasonLinkButton && (
                                        <>
                                            <span>•</span>
                                            <MdlSeasonLinkButton
                                                tmdbExternalId={media.externalId}
                                                season={selectedSeason}
                                                mediaId={media.id}
                                                title={media.title}
                                            />
                                        </>
                                    )}
                                    {selectedSeason <= 1 && (
                                        <MdlLinkEditor
                                            tmdbExternalId={media.externalId}
                                            mediaType={media.type === "TV" ? "tv" : "movie"}
                                            currentSlug={cached?.mdlSlug}
                                            defaultQuery={media.title}
                                            mediaId={media.id}
                                            isDisabled={cached?.mdlDisabled ?? false}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {(media.aired || media.network || media.duration || media.contentRating) && (
                        <div className="md:hidden grid grid-cols-[80px_1fr] gap-x-4 gap-y-1.5 text-sm">
                            <Suspense
                                fallback={
                                    <>
                                        <span className="text-gray-400">Aired</span>
                                        <span className="text-white">{media.aired}</span>
                                    </>
                                }
                            >
                                <MdlAiredRow
                                    externalId={media.externalId}
                                    title={media.title}
                                    year={media.year}
                                    nativeTitle={media.nativeTitle}
                                    season={selectedSeason}
                                    fallback={media.aired}
                                />
                            </Suspense>
                            {media.network && (
                                <>
                                    <span className="text-gray-400">Network</span>
                                    <span className="text-white">{media.network}</span>
                                </>
                            )}
                            {media.duration && (
                                <>
                                    <span className="text-gray-400">Duration</span>
                                    <span className="text-white">{media.duration}</span>
                                </>
                            )}
                            {media.contentRating && (
                                <>
                                    <span className="text-gray-400">Rating</span>
                                    <span className="text-gray-300">{media.contentRating}</span>
                                </>
                            )}
                        </div>
                    )}

                    {/* In-page navigation */}
                    {(() => {
                        const navSections: NavSection[] = [
                            { id: "section-cast", label: "Cast" },
                            ...(media.type === "TV" && episodes.length > 0 ? [{ id: "section-episodes", label: "Episodes" }] : []),
                            ...((media.images?.backdrops?.length ?? 0) > 0 ? [{ id: "section-photos", label: "Photos" }] : []),
                            ...(isMdlRelevant ? [{ id: "section-reviews", label: "Reviews" }] : []),
                            { id: "section-recommendations", label: "Recs" },
                            ...(isMdlRelevant ? [{ id: "section-comments", label: "Comments" }] : []),
                        ];
                        return <MediaNav sections={navSections} />;
                    })()}

                    {/* MDL Tags + Cast — streams in after TMDB synopsis + cast (fallback) */}
                    <div id="section-cast">
                        {isMdlRelevant ? (
                            <Suspense
                                fallback={
                                    <div className="space-y-4">
                                        <SynopsisBlock text={seasonOverview || media.synopsis || ""} />
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
                                    tmdbSynopsis={seasonOverview || media.synopsis || ""}
                                    originCountry={media.originCountry}
                                />
                            </Suspense>
                        ) : (
                            <>
                                <SynopsisBlock text={seasonOverview || media.synopsis || ""} />
                                <CastScroll cast={media.cast || []} mediaId={media.id} />
                            </>
                        )}
                    </div>

                    {/* Episode Guide */}
                    {media.type === "TV" && episodes.length > 0 && (
                        <div id="section-episodes" className="border-t border-white/8 pt-8">
                            {isMdlRelevant ? (
                                <Suspense fallback={<EpisodeGuide episodes={episodes} season={selectedSeason} poster={media.poster} watchedProgress={userMedia?.progress} hideSpoilers={displayPrefs.hideSpoilers} />}>
                                    <MdlEpisodeGuideSection
                                        tmdbEpisodes={episodes}
                                        season={selectedSeason}
                                        poster={media.poster}
                                        externalId={media.externalId}
                                        mediaId={id}
                                        watchedProgress={userMedia?.progress}
                                        hideSpoilers={displayPrefs.hideSpoilers}
                                    />
                                </Suspense>
                            ) : (
                                <EpisodeGuide episodes={episodes} season={selectedSeason} poster={media.poster} watchedProgress={userMedia?.progress} hideSpoilers={displayPrefs.hideSpoilers} />
                            )}
                        </div>
                    )}

                    {/* Photos */}
                    <div id="section-photos" className="border-t border-white/8 pt-8">
                        <PhotosScroll backdrops={media.images?.backdrops || []} mediaId={media.id} />
                    </div>

                    {/* MDL Reviews */}
                    {isMdlRelevant && (
                        <div id="section-reviews" className="border-t border-white/8 pt-8">
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
                    <div id="section-recommendations" className="border-t border-white/8 pt-8">
                        <Suspense fallback={<div className="h-6 w-40 rounded bg-white/5 animate-pulse mb-4" />}>
                            <MdlRecsSection
                                tmdbRecs={media.recommendations || []}
                                externalId={media.externalId}
                                season={selectedSeason}
                                watchlistIds={watchlistExternalIds}
                            />
                        </Suspense>
                    </div>

                    {/* MDL Comments */}
                    {isMdlRelevant && (
                        <div id="section-comments" className="border-t border-white/8 pt-8">
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
