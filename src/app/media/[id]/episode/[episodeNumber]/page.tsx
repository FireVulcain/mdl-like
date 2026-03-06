import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Calendar, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisode, kuryanaGetEpisodesList, KuryanaEpisodeReview } from "@/lib/kuryana";

async function getMdlSlug(id: string): Promise<string | null> {
    const dashIdx = id.indexOf("-");
    const source = id.slice(0, dashIdx);
    const externalId = id.slice(dashIdx + 1);

    if (source === "mdl") return externalId;

    if (source === "tmdb") {
        const cached = await prisma.cachedMdlData.findUnique({
            where: { tmdbExternalId: externalId },
            select: { mdlSlug: true },
        });
        return cached?.mdlSlug ?? null;
    }

    return null;
}

function EpisodeReviewCard({ review }: { review: KuryanaEpisodeReview }) {
    const isLong = review.body.length > 300;

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/3 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 bg-gray-800 flex items-center justify-center">
                        {review.author_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={review.author_avatar} alt={review.author} className="size-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold text-gray-500">
                                {review.author.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <a
                            href={review.author_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white hover:text-blue-400 transition-colors truncate block"
                        >
                            {review.author}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{review.date}</span>
                            {review.helpful_count > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{review.helpful_count} found helpful</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {review.rating > 0 && (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/15">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">{review.rating.toFixed(1)}</span>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                {review.headline && (
                    <p className="text-sm font-semibold text-white leading-snug">{review.headline}</p>
                )}
                {review.body && (
                    <p className={`text-sm text-gray-300 leading-relaxed whitespace-pre-line ${isLong ? "line-clamp-6" : ""}`}>
                        {review.body}
                    </p>
                )}
            </div>
        </div>
    );
}

export default async function EpisodePage({
    params,
}: {
    params: Promise<{ id: string; episodeNumber: string }>;
}) {
    const { id, episodeNumber } = await params;
    const epNum = parseInt(episodeNumber);
    if (isNaN(epNum)) notFound();

    const mdlSlug = await getMdlSlug(id);
    if (!mdlSlug) notFound();

    const episode = await kuryanaGetEpisode(mdlSlug, epNum);
    if (!episode?.data) notFound();

    const d = episode.data;
    const reviews = d.reviews ?? [];

    return (
        <div className="min-h-screen">
            <div className="container py-8 space-y-8 m-auto max-w-3xl">
                {/* Back link */}
                <Link
                    href={`/media/${id}`}
                    className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Link>

                {/* Episode header */}
                <div className="space-y-4">
                    {/* Image + title side by side */}
                    {d.image && (
                        <div className="flex gap-5 items-start">
                            <div className="relative shrink-0 w-40 h-40 overflow-hidden rounded-xl bg-gray-900 shadow-lg ring-1 ring-white/5">
                                <Image
                                    unoptimized
                                    src={d.image}
                                    alt={d.title}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2 pt-1">
                                <p className="text-sm text-gray-400">{d.title}</p>
                                <h1 className="text-2xl font-bold text-white leading-snug">
                                    {d.episode_title || `Episode ${epNum}`}
                                </h1>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
                                    {d.air_date && (
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="size-3.5" />
                                            <span>{d.air_date}</span>
                                        </div>
                                    )}
                                    {d.rating > 0 && (
                                        <div className="flex items-center gap-1.5">
                                            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                                            <span className="text-yellow-400 font-medium">{d.rating.toFixed(1)}</span>
                                        </div>
                                    )}
                                    <a
                                        href={d.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="size-3.5" />
                                        MDL
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fallback title block when there's no image */}
                    {!d.image && (
                        <div>
                            <p className="text-sm text-gray-400 mb-1">{d.title}</p>
                            <h1 className="text-2xl font-bold text-white">
                                {d.episode_title || `Episode ${epNum}`}
                            </h1>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-400">
                                {d.air_date && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="size-3.5" />
                                        <span>{d.air_date}</span>
                                    </div>
                                )}
                                {d.rating > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                                        <span className="text-yellow-400 font-medium">{d.rating.toFixed(1)}</span>
                                    </div>
                                )}
                                <a
                                    href={d.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                >
                                    <ExternalLink className="size-3.5" />
                                    MDL
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Synopsis */}
                    {d.synopsis && (
                        <p className="text-sm text-gray-300 leading-relaxed">{d.synopsis}</p>
                    )}
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                {/* Reviews */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">Episode Reviews</h2>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                            via MDL
                        </span>
                        {reviews.length > 0 && (
                            <span className="text-sm text-gray-500">({reviews.length})</span>
                        )}
                    </div>

                    {reviews.length === 0 ? (
                        <p className="text-sm text-gray-500 py-4">No reviews yet for this episode.</p>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {reviews.map((review) => (
                                <EpisodeReviewCard key={review.id} review={review} />
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
