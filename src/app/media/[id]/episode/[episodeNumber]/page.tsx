import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Star, Calendar, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { kuryanaGetEpisode, kuryanaGetEpisodesList } from "@/lib/kuryana";
import { EpisodeReviewCard } from "@/components/media/episode-review-card";

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

    // Fetch the episode detail and the season's episode list together — the list
    // gives us the total count, so prev/next can be bounded correctly.
    const [episode, list] = await Promise.all([
        kuryanaGetEpisode(mdlSlug, epNum),
        kuryanaGetEpisodesList(mdlSlug),
    ]);
    if (!episode?.data) notFound();

    const d = episode.data;
    const reviews = d.reviews ?? [];

    // Highest episode number MDL knows for this show (link ends in /episode/N)
    const totalEpisodes = (list?.data?.episodes ?? []).reduce((max, ep) => {
        const n = parseInt(ep.link.match(/\/episode\/(\d+)/)?.[1] ?? "0");
        return n > max ? n : max;
    }, 0);
    const hasPrev = epNum > 1;
    const hasNext = totalEpisodes > 0 ? epNum < totalEpisodes : true;

    const prevHref = `/media/${id}/episode/${epNum - 1}`;
    const nextHref = `/media/${id}/episode/${epNum + 1}`;

    const meta = (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-400">
            {d.air_date && (
                <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    <span>{d.air_date}</span>
                </div>
            )}
            {/* Scraped from MDL, so it wears MDL blue — yellow means TMDB */}
            {d.rating > 0 && (
                <div className="flex items-center gap-1.5">
                    <Star className="size-3.5 fill-sky-400 text-sky-400" />
                    <span className="text-sky-400 font-medium">{d.rating.toFixed(1)}</span>
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
    );

    return (
        <div className="min-h-screen">
            <div className="container py-8 space-y-8 m-auto max-w-5xl px-4 md:px-6">
                {/* Top bar: back + episode pager */}
                <div className="flex items-center justify-between gap-4">
                    <Link
                        href={`/media/${id}`}
                        className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back
                    </Link>
                    <div className="flex items-center gap-4">
                        <EpisodePagerText href={prevHref} disabled={!hasPrev} direction="prev" label={`Ep ${epNum - 1}`} />
                        <EpisodePagerText href={nextHref} disabled={!hasNext} direction="next" label={`Ep ${epNum + 1}`} />
                    </div>
                </div>

                {/* Episode header — large still (natural ratio) with title beside it */}
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                    {d.image && (
                        <Image
                            unoptimized
                            src={d.image}
                            alt={d.title}
                            width={340}
                            height={340}
                            className="w-full sm:w-72 md:w-80 h-auto shrink-0 rounded-2xl bg-gray-900 shadow-2xl shadow-black/40 ring-1 ring-white/10"
                            priority
                        />
                    )}
                    <div className="space-y-3 min-w-0 flex-1">
                        <p className="text-sm text-gray-400">
                            {d.title} · Episode {epNum}
                            {totalEpisodes > 0 && <span className="text-gray-600"> / {totalEpisodes}</span>}
                        </p>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white leading-tight">
                            {d.episode_title || `Episode ${epNum}`}
                        </h1>
                        {meta}
                        {d.synopsis && (
                            <p className="text-sm md:text-base text-gray-300 leading-relaxed pt-1">{d.synopsis}</p>
                        )}
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-white/15 to-transparent" />

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
                        <div className="grid gap-3 md:grid-cols-2">
                            {reviews.map((review) => (
                                <EpisodeReviewCard key={review.id} review={review} />
                            ))}
                        </div>
                    )}
                </section>

                {/* Bottom pager — plain text links, like MDL */}
                <div className="flex items-center justify-between gap-4 pt-2">
                    <EpisodePagerText href={prevHref} disabled={!hasPrev} direction="prev" label={hasPrev ? `Previous Episode` : "First episode"} />
                    <EpisodePagerText href={nextHref} disabled={!hasNext} direction="next" label={hasNext ? `Next Episode` : "Last episode"} />
                </div>
            </div>
        </div>
    );
}

// Minimal text link with a chevron — matches the site's "Back" link language
function EpisodePagerText({ href, disabled, direction, label }: { href: string; disabled: boolean; direction: "prev" | "next"; label: string }) {
    const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
    const content = (
        <>
            {direction === "prev" && <Icon className="size-4" />}
            <span>{label}</span>
            {direction === "next" && <Icon className="size-4" />}
        </>
    );
    const base = "inline-flex items-center gap-1 text-sm font-medium transition-colors";
    if (disabled) {
        return <span className={`${base} text-gray-600 cursor-not-allowed`}>{content}</span>;
    }
    return <Link href={href} className={`${base} text-blue-400 hover:text-blue-300`}>{content}</Link>;
}
