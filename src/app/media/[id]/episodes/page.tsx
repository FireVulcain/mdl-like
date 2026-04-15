import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisodesList, kuryanaGetEpisode } from "@/lib/kuryana";
import type { MdlEpisodeItem } from "@/components/media/episode-guide";
import { EpisodeRatingsChart, type EpisodeChartPoint } from "@/components/media/episode-ratings-chart";
import { mediaService } from "@/services/media.service";

const SYNOPSIS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY_TTL_MS = 24 * 60 * 60 * 1000;

async function getMdlSlugForSeason(id: string, season: number): Promise<string | null> {
    const dashIdx = id.indexOf("-");
    const source = id.slice(0, dashIdx);
    const externalId = id.slice(dashIdx + 1);

    if (source === "mdl") return externalId;

    if (source === "tmdb") {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: externalId },
            select: { mdlSlug: true, mdlDisabled: true },
        });

        if (!cached?.mdlSlug || cached.mdlDisabled) return null;

        if (season === 1) return cached.mdlSlug;

        const seasonLink = await prisma.mdlSeasonLink.findUnique({
            where: { tmdbExternalId_season: { tmdbExternalId: externalId, season } },
        });
        return seasonLink?.mdlSlug ?? null;
    }

    return null;
}

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
        const age = now - row.cachedAt.getTime();
        return age > (row.synopsis ? SYNOPSIS_TTL_MS : EMPTY_TTL_MS);
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

        const title =
            episodeTitle ||
            (ep.title.startsWith(showTitle) ? ep.title.slice(showTitle.length).trim() : ep.title);

        const ratingMatch = ep.rating.match(/^([\d.]+)\//);
        const rating = detail?.data?.rating ?? (ratingMatch ? parseFloat(ratingMatch[1]) : null);

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
    const selectedSeason = season ? parseInt(season) : 1;

    const [mdlSlug, media] = await Promise.all([
        getMdlSlugForSeason(id, selectedSeason),
        mediaService.getDetails(id),
    ]);

    if (!mdlSlug || !media) notFound();

    const episodes = await fetchMdlEpisodes(mdlSlug);
    if (episodes.length === 0) notFound();

    const chartData: EpisodeChartPoint[] = episodes
        .filter((ep) => ep.rating !== null && ep.rating > 0)
        .map((ep) => ({
            ep: ep.number,
            label: `E${ep.number}`,
            rating: ep.rating!,
            title: ep.title,
        }));

    return (
        <div className="min-h-screen">
            <div className="container py-8 m-auto max-w-5xl px-4 md:px-6">
                {/* Back */}
                <Link
                    href={`/media/${id}`}
                    className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors mb-6"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Link>

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-white">{media.title}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-gray-400">
                            Season {selectedSeason} · {episodes.length} episodes
                        </p>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                            via MDL
                        </span>
                    </div>
                </div>

                {/* Rating chart */}
                {chartData.length > 1 && (
                    <div className="mb-8 rounded-xl border border-white/5 bg-white/3 p-4">
                        <p className="text-xs font-medium text-gray-400 mb-3">Episode Ratings</p>
                        <EpisodeRatingsChart data={chartData} />
                    </div>
                )}

                {/* Episode grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {episodes.map((ep) => (
                        <Link
                            key={ep.number}
                            href={`/media/${id}/episode/${ep.number}`}
                            className="group rounded-xl overflow-hidden border border-white/5 bg-white/3 hover:bg-white/6 transition-colors"
                        >
                            {/* Thumbnail */}
                            <div className="relative aspect-video bg-gray-800">
                                {ep.image ? (
                                    <Image
                                        unoptimized
                                        src={ep.image}
                                        alt={ep.title}
                                        fill
                                        className="object-cover"
                                        sizes="200px"
                                        loading="lazy"
                                    />
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

                            {/* Info */}
                            <div className="p-2">
                                <p
                                    className="text-xs font-medium text-white truncate leading-snug group-hover:text-blue-300 transition-colors"
                                    title={ep.title}
                                >
                                    {ep.title}
                                </p>
                                {ep.airDate && (
                                    <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                                        <Calendar className="size-2.5 shrink-0" />
                                        {new Date(ep.airDate).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </p>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
