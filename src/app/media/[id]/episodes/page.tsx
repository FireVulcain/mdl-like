import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisodesList, kuryanaGetEpisode } from "@/lib/kuryana";
import type { MdlEpisodeItem } from "@/components/media/episode-guide";
import { EpisodeRatingGrid, type GridRatings } from "@/components/media/episode-rating-grid";
import { mediaService } from "@/services/media.service";
import { tmdb } from "@/lib/tmdb";

const SYNOPSIS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 24 * 60 * 60 * 1000;

const NOW = new Date();
function isReleased(airDate: string | null | undefined): boolean {
    if (!airDate) return true; // no date info → assume released
    return new Date(airDate) <= NOW;
}

// Light fetch — episodes list only, no individual episode calls (just for grid ratings)
async function fetchMdlRatingsLight(mdlSlug: string): Promise<Map<number, number> | null> {
    const list = await kuryanaGetEpisodesList(mdlSlug);
    if (!list?.data?.episodes?.length) return null;
    const result = new Map<number, number>();
    list.data.episodes.forEach((ep, i) => {
        if (!isReleased(ep.air_date)) return;
        const m = ep.link.match(/\/episode\/(\d+)/);
        const num = m ? parseInt(m[1]) : i + 1;
        const ratingMatch = ep.rating.match(/^([\d.]+)\//);
        if (ratingMatch) {
            const r = parseFloat(ratingMatch[1]);
            if (r > 0) result.set(num, r);
        }
    });
    return result.size > 0 ? result : null;
}

// Full fetch with DB caching — for selected season detail (images, synopsis, etc.)
async function fetchMdlEpisodes(mdlSlug: string): Promise<MdlEpisodeItem[]> {
    const list = await kuryanaGetEpisodesList(mdlSlug);
    if (!list?.data?.episodes?.length) return [];

    const listEpisodes = list.data.episodes;
    const showTitle = list.data.title;

    const episodeNumbers = listEpisodes.map((ep, i) => {
        const m = ep.link.match(/\/episode\/(\d+)/);
        return m ? parseInt(m[1]) : i + 1;
    });

    const now = Date.now();
    const cachedRows = await prisma.cachedMdlEpisode.findMany({
        where: { mdlSlug, episodeNumber: { in: episodeNumbers } },
    });
    const cacheMap = new Map(cachedRows.map((r) => [r.episodeNumber, r]));

    const staleNumbers = episodeNumbers.filter((n) => {
        const row = cacheMap.get(n);
        if (!row) return true;
        return Date.now() - row.cachedAt.getTime() > (row.synopsis ? SYNOPSIS_TTL_MS : EMPTY_TTL_MS);
    });

    const freshDetails = staleNumbers.length
        ? await Promise.all(staleNumbers.map((n) => kuryanaGetEpisode(mdlSlug, n)))
        : [];

    if (freshDetails.length) {
        await Promise.all(
            staleNumbers.map((n, i) => {
                const detail = freshDetails[i];
                return prisma.cachedMdlEpisode.upsert({
                    where: { mdlSlug_episodeNumber: { mdlSlug, episodeNumber: n } },
                    create: { mdlSlug, episodeNumber: n, synopsis: detail?.data?.synopsis || null, episodeTitle: detail?.data?.episode_title || null },
                    update: { synopsis: detail?.data?.synopsis || null, episodeTitle: detail?.data?.episode_title || null, cachedAt: new Date() },
                });
            })
        );
    }

    const freshMap = new Map(staleNumbers.map((n, i) => [n, freshDetails[i]]));

    return listEpisodes.map((ep, i) => {
        const number = episodeNumbers[i];
        const cached = cacheMap.get(number);
        const detail = freshMap.get(number);
        const episodeTitle = detail?.data?.episode_title || cached?.episodeTitle || null;
        const synopsis = detail?.data?.synopsis || cached?.synopsis || null;
        const title = episodeTitle || (ep.title.startsWith(showTitle) ? ep.title.slice(showTitle.length).trim() : ep.title);
        const ratingMatch = ep.rating.match(/^([\d.]+)\//);
        const rawRating = detail?.data?.rating ?? (ratingMatch ? parseFloat(ratingMatch[1]) : null);
        const rating = isReleased(ep.air_date) ? rawRating : null;
        return { number, title, image: ep.image || null, airDate: ep.air_date || null, rating, synopsis };
    });
}

export default async function EpisodesPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ season?: string }>;
}) {
    const [{ id }, { season }] = await Promise.all([params, searchParams]);
    const selectedSeason = Math.max(1, season ? parseInt(season) : 1);

    const media = await mediaService.getDetails(id);
    if (!media || media.type !== "TV") notFound();

    const dashIdx = id.indexOf("-");
    const source = id.slice(0, dashIdx);
    const externalId = id.slice(dashIdx + 1);
    const isTmdb = source === "tmdb";

    // MDL-native shows may not have a seasons array (comes from TMDB) — default to season 1
    const allSeasons = (media.seasons ?? []).filter((s) => s.seasonNumber > 0);
    const effectiveSeasons = allSeasons.length > 0 ? allSeasons : [{ seasonNumber: 1, episodeCount: 0, name: "Season 1", poster: null, airDate: null }];
    const seasonNumbers = effectiveSeasons.map((s) => s.seasonNumber);

    // ── MDL slug resolution ──────────────────────────────────────────────────
    const mdlSlugMap = new Map<number, string>();
    if (isTmdb) {
        const [cachedMdl, seasonLinks] = await Promise.all([
            prisma.cachedMdlData.findUnique({
                where: { tmdbExternalId: externalId },
                select: { mdlSlug: true, mdlDisabled: true },
            }),
            prisma.mdlSeasonLink.findMany({
                where: { tmdbExternalId: externalId },
                select: { season: true, mdlSlug: true },
            }),
        ]);
        if (cachedMdl?.mdlSlug && !cachedMdl.mdlDisabled) mdlSlugMap.set(1, cachedMdl.mdlSlug);
        for (const link of seasonLinks) mdlSlugMap.set(link.season, link.mdlSlug);
    } else {
        // MDL-native: externalId is already the MDL slug
        mdlSlugMap.set(1, externalId);
    }

    // Verify at least one MDL slug or TMDB data exists
    const selectedMdlSlug = mdlSlugMap.get(selectedSeason) ?? mdlSlugMap.get(1) ?? null;
    if (!isTmdb && !selectedMdlSlug) notFound();

    // ── Parallel: TMDB all seasons (TMDB only) + MDL light ratings + MDL full ──
    const [tmdbResults, mdlLightResults, mdlEpisodes] = await Promise.all([
        // TMDB episodes — only fetch when source is TMDB
        isTmdb ? Promise.all(
            seasonNumbers.map(async (sNum) => {
                try {
                    const data = await tmdb.getSeasonDetails(externalId, sNum);
                    return { season: sNum, episodes: data.episodes ?? [] };
                } catch {
                    return { season: sNum, episodes: [] };
                }
            })
        ) : Promise.resolve(seasonNumbers.map((sNum) => ({ season: sNum, episodes: [] }))),
        // MDL light ratings for every season (grid only)
        Promise.all(
            seasonNumbers.map(async (sNum) => {
                const slug = mdlSlugMap.get(sNum);
                if (!slug) return { season: sNum, ratings: null };
                return { season: sNum, ratings: await fetchMdlRatingsLight(slug) };
            })
        ),
        // MDL full episodes for selected season (chart + cards)
        selectedMdlSlug ? fetchMdlEpisodes(selectedMdlSlug) : Promise.resolve([]),
    ]);

    // ── Build TMDB grid ──────────────────────────────────────────────────────
    const tmdbGrid: GridRatings = {};
    const tmdbAvg: Record<number, number | null> = {};
    for (const { season: sNum, episodes } of tmdbResults) {
        tmdbGrid[sNum] = {};
        const rated = episodes.filter((ep) => ep.vote_average > 0 && isReleased(ep.air_date));
        for (const ep of rated) tmdbGrid[sNum][ep.episode_number] = ep.vote_average;
        tmdbAvg[sNum] = rated.length ? rated.reduce((s, e) => s + e.vote_average, 0) / rated.length : null;
    }

    // ── Build MDL grid ───────────────────────────────────────────────────────
    const mdlGrid: GridRatings = {};
    const mdlAvg: Record<number, number | null> = {};
    let hasMdlData = false;
    for (const { season: sNum, ratings } of mdlLightResults) {
        mdlGrid[sNum] = {};
        if (ratings && ratings.size > 0) {
            hasMdlData = true;
            let sum = 0, count = 0;
            for (const [ep, r] of ratings) { mdlGrid[sNum][ep] = r; sum += r; count++; }
            mdlAvg[sNum] = count > 0 ? sum / count : null;
        } else {
            mdlAvg[sNum] = null;
        }
    }

    // ── Max episodes for grid row count ─────────────────────────────────────
    const maxEpisodes = Math.max(
        1,
        ...effectiveSeasons.map((s) =>
            Math.max(
                s.episodeCount ?? 0,
                Object.keys(tmdbGrid[s.seasonNumber] ?? {}).length,
                Object.keys(mdlGrid[s.seasonNumber] ?? {}).length,
            )
        )
    );

    // ── Selected season detail data ──────────────────────────────────────────
    const selectedTmdb = tmdbResults.find((r) => r.season === selectedSeason)?.episodes ?? [];
    const hasMdlForSelected = mdlEpisodes.length > 0;

    // Cards: prefer MDL (has images + links), fall back to TMDB
    type CardEpisode = { number: number; title: string; image: string | null; airDate: string | null; rating: number | null; isLinked: boolean };
    const cards: CardEpisode[] = hasMdlForSelected
        ? mdlEpisodes.map((ep) => ({ number: ep.number, title: ep.title, image: ep.image, airDate: ep.airDate, rating: ep.rating, isLinked: true }))
        : selectedTmdb.map((ep) => ({
              number: ep.episode_number,
              title: ep.name,
              image: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
              airDate: ep.air_date,
              rating: ep.vote_average > 0 ? ep.vote_average : null,
              isLinked: false,
          }));

    // Chart: prefer MDL ratings, fall back to TMDB
    const isMultiSeason = allSeasons.length > 1;

    return (
        <div className="min-h-screen">
            <div className="container py-8 m-auto max-w-5xl px-4 md:px-6 space-y-8">
                {/* Back */}
                <Link href={`/media/${id}`} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Link>

                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">{media.title}</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        {effectiveSeasons.length} season{effectiveSeasons.length !== 1 ? "s" : ""}
                    </p>
                </div>

                {/* Rating grid */}
                <div className="rounded-xl border border-white/5 bg-white/3 p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <h2 className="text-sm font-semibold text-white">Episode Ratings</h2>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${hasMdlData ? "bg-sky-500/15 text-sky-400 border-sky-500/20" : "bg-white/5 text-gray-400 border-white/10"}`}>
                            via {hasMdlData ? "MDL" : "TMDB"}
                        </span>
                    </div>
                    <EpisodeRatingGrid
                        mediaId={id}
                        seasons={seasonNumbers}
                        maxEpisodes={maxEpisodes}
                        tmdbGrid={tmdbGrid}
                        mdlGrid={hasMdlData ? mdlGrid : undefined}
                        tmdbAvg={tmdbAvg}
                        mdlAvg={hasMdlData ? mdlAvg : undefined}
                        selectedSeason={selectedSeason}
                    />
                </div>

                {/* Season detail */}
                <div>
                    {/* Season header + tabs */}
                    <div className="flex items-center gap-3 mb-5 flex-wrap">
                        <h2 className="text-lg font-semibold text-white shrink-0">
                            Season {selectedSeason}
                        </h2>
                        {hasMdlForSelected && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                                via MDL
                            </span>
                        )}
                        {isMultiSeason && (
                            <div className="flex gap-1 ml-auto flex-wrap">
                                {seasonNumbers.map((s) => (
                                    <Link
                                        key={s}
                                        href={`/media/${id}/episodes?season=${s}`}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                            s === selectedSeason
                                                ? "bg-white/15 text-white"
                                                : "text-gray-400 hover:text-white hover:bg-white/10"
                                        }`}
                                    >
                                        S{s}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Episode cards */}
                    {cards.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {cards.map((ep) => {
                                const inner = (
                                    <>
                                        <div className="relative aspect-video bg-gray-800">
                                            {ep.image ? (
                                                <Image unoptimized src={ep.image} alt={ep.title} fill className="object-cover" sizes="200px" loading="lazy" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <span className="text-[10px] text-gray-600">No image</span>
                                                </div>
                                            )}
                                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                                                Ep {ep.number}
                                            </span>
                                            {ep.rating !== null && ep.rating > 0 && (
                                                <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400 backdrop-blur-sm">
                                                    <Star className="size-2.5 fill-current" />
                                                    {ep.rating.toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-xs font-medium text-white truncate leading-snug group-hover:text-blue-300 transition-colors" title={ep.title}>
                                                {ep.title}
                                            </p>
                                            {ep.airDate && (
                                                <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                                                    <Calendar className="size-2.5 shrink-0" />
                                                    {new Date(ep.airDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                </p>
                                            )}
                                        </div>
                                    </>
                                );

                                return ep.isLinked ? (
                                    <Link key={ep.number} href={`/media/${id}/episode/${ep.number}`} className="group rounded-xl overflow-hidden border border-white/5 bg-white/3 hover:bg-white/6 transition-colors">
                                        {inner}
                                    </Link>
                                ) : (
                                    <div key={ep.number} className="group rounded-xl overflow-hidden border border-white/5 bg-white/3">
                                        {inner}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No episode data available for this season.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
