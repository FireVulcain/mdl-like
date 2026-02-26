import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, ExternalLink, Film, Star, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { kuryanaGetPerson, kuryanaGetDetails, KuryanaWorkItem, KuryanaPersonResult } from "@/lib/kuryana";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { MdlPersonImage } from "@/components/media/mdl-person-image";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { tmdb, TMDB_CONFIG } from "@/lib/tmdb";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { BiographyExpander } from "@/components/media/biography-expander";

function sortWorks(works: KuryanaWorkItem[]): KuryanaWorkItem[] {
    return [...works].sort((a, b) => {
        if (a.year === "TBA" && b.year !== "TBA") return 1;
        if (a.year !== "TBA" && b.year === "TBA") return -1;
        if (typeof a.year === "number" && typeof b.year === "number") return b.year - a.year;
        return 0;
    });
}

function extractMdlId(slug: string): string | null {
    const match = slug.match(/^mdl-(\d+)$/);
    return match ? match[1] : null;
}

function extractFullMdlSlug(link: string): string | null {
    const match = link.match(/mydramalist\.com\/(.+)$/);
    return match ? match[1] : null;
}

// Async server component — streams in the Kuryana poster for unlinked dramas
async function MdlDramaPoster({ mdlSlug }: { mdlSlug: string }) {
    const details = await kuryanaGetDetails(mdlSlug);
    const poster = details?.data?.poster;
    if (!poster) {
        return <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>;
    }
    return <Image src={poster} alt="poster" fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw" />;
}

// Max concurrent Kuryana poster fetches — beyond this, unlinked cards show "No Image" statically
const MAX_KURYANA_POSTER_FETCHES = 12;

function WorkCard({
    work,
    internalLink,
    poster,
    posterSlug,
    linkSlug,
    inWatchlist,
    mdlRating,
}: {
    work: KuryanaWorkItem;
    internalLink: string | null;
    poster: string | null;
    posterSlug: string | null; // budget-capped: drives the Kuryana poster Suspense
    linkSlug: string | null; // always set: drives the Link button
    inWatchlist: boolean;
    mdlRating?: number | null;
}) {
    const title = work.title.name;
    const year = typeof work.year === "number" ? work.year : "TBA";
    const character = work.role.name || null;

    const card = (
        <div className="space-y-2">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-linear-to-br from-gray-800 to-gray-900 shadow-lg ring-2 ring-white/10 hover:ring-white/20 transition-all hover:scale-105">
                {poster ? (
                    <Image src={poster} alt={title} fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw" />
                ) : posterSlug ? (
                    <Suspense
                        fallback={
                            <div className="w-full h-full bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                        }
                    >
                        <MdlDramaPoster mdlSlug={posterSlug} />
                    </Suspense>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
                )}

                {(work.rating > 0 || (mdlRating != null && mdlRating > 0)) && (
                    <div className="absolute left-1.5 top-1.5 flex flex-row gap-1">
                        {work.rating > 0 && (
                            <Badge className="bg-yellow-500/90 text-black text-[10px] px-1.5">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                {work.rating.toFixed(1)}
                            </Badge>
                        )}
                        {mdlRating != null && mdlRating > 0 && (
                            <Badge className="bg-sky-500/90 text-white text-[10px] px-1.5">
                                <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />
                                {mdlRating.toFixed(1)}
                            </Badge>
                        )}
                    </div>
                )}

                {work.episodes && work.episodes > 0 && (
                    <div className="absolute bottom-1.5 right-1.5">
                        <Badge className="bg-purple-500/80 text-xs text-white backdrop-blur-sm">{work.episodes} ep</Badge>
                    </div>
                )}

                {inWatchlist && (
                    <div className="absolute bottom-1.5 left-1.5">
                        <Badge className="bg-emerald-500/90 text-xs text-white backdrop-blur-sm px-1.5">
                            <Bookmark className="h-3 w-3 fill-current" />
                        </Badge>
                    </div>
                )}

                {!internalLink && linkSlug && (
                    <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/70 backdrop-blur-sm">
                        <LinkToTmdbButton mdlSlug={linkSlug} defaultQuery={title} />
                    </div>
                )}
            </div>

            <div>
                <p className="font-semibold text-sm leading-tight text-white group-hover:text-blue-400 transition-colors line-clamp-1">{title}</p>
                {character && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">as {character}</p>}
                <p className="text-xs text-gray-500 mt-0.5">{year}</p>
            </div>
        </div>
    );

    if (internalLink) {
        return (
            <Link href={internalLink} className="group block">
                {card}
            </Link>
        );
    }

    if (!linkSlug) {
        return (
            <a href={work.title.link} target="_blank" rel="noopener noreferrer" className="group block">
                {card}
            </a>
        );
    }

    return <div className="group">{card}</div>;
}

export default async function MdlPersonPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Check DB cache first (7-day TTL) — avoids a live Kuryana call on every page visit
    const PERSON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const staleAt = new Date(Date.now() - PERSON_CACHE_TTL_MS);
    const cachedRow = await prisma.cachedKuryanaPerson.findUnique({ where: { slug } });

    let data: KuryanaPersonResult["data"] | null = null;
    if (cachedRow && cachedRow.cachedAt > staleAt) {
        data = cachedRow.dataJson as KuryanaPersonResult["data"];
    } else {
        const fetched = await kuryanaGetPerson(slug);
        data = fetched?.data ?? null;
        if (data) {
            await prisma.cachedKuryanaPerson.upsert({
                where: { slug },
                create: { slug, dataJson: data as unknown as Prisma.InputJsonValue },
                update: { dataJson: data as unknown as Prisma.InputJsonValue, cachedAt: new Date() },
            });
        }
    }
    if (!data) notFound();
    const details = data.details ?? {};

    const dramas = sortWorks(data.works.Drama ?? []);
    const movies = sortWorks(data.works.Movie ?? []);
    const specials = sortWorks(data.works.Special ?? []);

    // Batch cross-reference all work items against our CachedMdlData
    const allWorks = [...dramas, ...movies, ...specials];
    const mdlIds = allWorks.map((w) => extractMdlId(w._slug)).filter(Boolean) as string[];

    const cached =
        mdlIds.length > 0
            ? await prisma.cachedMdlData.findMany({
                  where: { OR: mdlIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
                  select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true },
              })
            : [];

    const mdlToTmdb = new Map<string, string>(); // numericMdlId → tmdbExternalId
    const mdlRatingMap = new Map<string, number>(); // numericMdlId → mdlRating
    for (const item of cached) {
        const numericId = item.mdlSlug.split("-")[0];
        mdlToTmdb.set(numericId, item.tmdbExternalId);
        if (item.mdlRating != null) mdlRatingMap.set(numericId, item.mdlRating);
    }

    // Batch-fetch TMDB posters for linked works (server-side, cached 1h by Next.js)
    type LinkedEntry = { mdlNumericId: string; tmdbExternalId: string; mediaType: "tv" | "movie" };
    const linkedEntries: LinkedEntry[] = [];
    const seenTmdbIds = new Set<string>();

    for (const work of [...dramas, ...specials]) {
        const id = extractMdlId(work._slug);
        if (id && mdlToTmdb.has(id)) {
            const tmdbId = mdlToTmdb.get(id)!;
            if (!seenTmdbIds.has(tmdbId)) {
                seenTmdbIds.add(tmdbId);
                linkedEntries.push({ mdlNumericId: id, tmdbExternalId: tmdbId, mediaType: "tv" });
            }
        }
    }
    for (const work of movies) {
        const id = extractMdlId(work._slug);
        if (id && mdlToTmdb.has(id)) {
            const tmdbId = mdlToTmdb.get(id)!;
            if (!seenTmdbIds.has(tmdbId)) {
                seenTmdbIds.add(tmdbId);
                linkedEntries.push({ mdlNumericId: id, tmdbExternalId: tmdbId, mediaType: "movie" });
            }
        }
    }

    const [tmdbDetails, watchlistExternalIds] = await Promise.all([
        Promise.all(linkedEntries.map(({ tmdbExternalId, mediaType }) => tmdb.getDetails(mediaType, tmdbExternalId).catch(() => null))),
        getWatchlistExternalIds(),
    ]);
    const watchlistIds = new Set(watchlistExternalIds);

    const posterMap = new Map<string, string | null>(); // numericMdlId → poster URL
    linkedEntries.forEach(({ mdlNumericId }, i) => {
        const detail = tmdbDetails[i];
        posterMap.set(mdlNumericId, detail?.poster_path ? TMDB_CONFIG.w342Image(detail.poster_path) : null);
    });

    function getPoster(work: KuryanaWorkItem): string | null {
        const id = extractMdlId(work._slug);
        return id ? posterMap.get(id) ?? null : null;
    }

    function getInternalLink(work: KuryanaWorkItem): string | null {
        const id = extractMdlId(work._slug);
        if (!id) return null;
        const tmdbId = mdlToTmdb.get(id);
        return tmdbId ? `/media/tmdb-${tmdbId}` : null;
    }

    // Only give the first MAX_KURYANA_POSTER_FETCHES unlinked works a slug to fetch —
    // the rest show "No Image" statically so we don't fire dozens of Kuryana calls.
    let kuryanaPosterBudget = MAX_KURYANA_POSTER_FETCHES;
    function getMdlSlugForCard(work: KuryanaWorkItem): string | null {
        const internalLink = getInternalLink(work);
        if (internalLink) return extractFullMdlSlug(work.title.link); // linked — no Kuryana needed
        const slug = extractFullMdlSlug(work.title.link);
        if (!slug || kuryanaPosterBudget <= 0) return null;
        kuryanaPosterBudget--;
        return slug;
    }

    function isInWatchlist(work: KuryanaWorkItem): boolean {
        const id = extractMdlId(work._slug);
        if (!id) return false;
        const tmdbId = mdlToTmdb.get(id);
        return tmdbId ? watchlistIds.has(tmdbId) : false;
    }

    function getCachedMdlRating(work: KuryanaWorkItem): number | null {
        const id = extractMdlId(work._slug);
        if (!id) return null;
        return mdlRatingMap.get(id) ?? null;
    }

    const bio = data.about
        ? data.about
              .replace(/\s*\(?\s*Source:[\s\S]*$/i, "") // strip (Source: ...) and everything after
              .replace(/\s*Edit Biography[\s\S]*$/i, "") // strip Edit Biography and everything after
              .replace(/[\s(]+$/, "") // strip any trailing ( or whitespace left behind
              .trim()
        : null;
    const alsoKnownAs = details.also_known_as
        ? details.also_known_as
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
        : [];

    const grid = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4";

    return (
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container py-8 space-y-8 m-auto">
                <Link href="/" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>

                <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                    {/* Left: Photo + Info */}
                    <div className="space-y-4 md:sticky md:top-24 md:self-start">
                        {data.profile ? (
                            <MdlPersonImage src={data.profile} alt={data.name} />
                        ) : (
                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/10 flex items-center justify-center text-gray-400 bg-linear-to-br from-gray-800 to-gray-900">
                                No Image
                            </div>
                        )}

                        <div
                            className="relative overflow-hidden rounded-xl border border-white/10 p-6 shadow-lg space-y-3"
                            style={{
                                background: "rgba(17, 24, 39, 0.6)",
                                backdropFilter: "blur(20px)",
                                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.1)",
                            }}
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
                            <h3 className="font-semibold text-lg text-white mb-4">Personal Info</h3>

                            <div className="space-y-4 text-sm">
                                {details.gender && (
                                    <div>
                                        <span className="text-gray-400 font-medium block mb-1">Gender</span>
                                        <span className="text-white">{details.gender}</span>
                                    </div>
                                )}
                                {details.born && (
                                    <div>
                                        <span className="text-gray-400 font-medium block mb-1">Born</span>
                                        <span className="text-white">
                                            {details.born}
                                            {details.age && ` (age ${details.age})`}
                                        </span>
                                    </div>
                                )}
                                {details.nationality && (
                                    <div>
                                        <span className="text-gray-400 font-medium block mb-1">Nationality</span>
                                        <span className="text-white">{details.nationality}</span>
                                    </div>
                                )}
                                {alsoKnownAs.length > 0 && (
                                    <div>
                                        <span className="text-gray-400 font-medium block mb-1">Also Known As</span>
                                        <div className="flex flex-wrap gap-1">
                                            {alsoKnownAs.slice(0, 6).map((name) => (
                                                <Badge key={name} variant="secondary" className="text-xs bg-white/10 text-gray-300 border-white/10">
                                                    {name}
                                                </Badge>
                                            ))}
                                            {alsoKnownAs.length > 6 && (
                                                <Badge variant="secondary" className="text-xs bg-white/10 text-gray-400 border-white/10">
                                                    +{alsoKnownAs.length - 6} more
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Name + Bio + Filmography */}
                    <div className="space-y-8">
                        <div>
                            <h1 className="text-4xl font-bold mb-2 text-white">{data.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                <Badge variant="outline" className="bg-white/5 text-gray-300 border-white/20">
                                    via MDL
                                </Badge>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-400">{dramas.length + movies.length + specials.length} works</span>
                                <span className="text-gray-500">•</span>
                                <a
                                    href={data.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                                >
                                    View on MDL
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </div>

                        {bio && (
                            <div>
                                <h3 className="text-lg font-semibold mb-3 text-white">Biography</h3>
                                <BiographyExpander text={bio} />
                            </div>
                        )}

                        <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                        {dramas.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-purple-500 to-pink-500 rounded-full" />
                                    <Tv className="h-5 w-5 text-purple-400" />
                                    <h3 className="text-lg font-semibold text-white">Dramas</h3>
                                    <span className="text-sm text-gray-400">({dramas.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>
                                <div className={grid}>
                                    {dramas.map((work) => (
                                        <WorkCard
                                            key={work._slug}
                                            work={work}
                                            internalLink={getInternalLink(work)}
                                            poster={getPoster(work)}
                                            posterSlug={getMdlSlugForCard(work)}
                                            linkSlug={extractFullMdlSlug(work.title.link)}
                                            inWatchlist={isInWatchlist(work)}
                                            mdlRating={getCachedMdlRating(work)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {movies.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-blue-500 to-blue-400 rounded-full" />
                                    <Film className="h-5 w-5 text-blue-400" />
                                    <h3 className="text-lg font-semibold text-white">Movies</h3>
                                    <span className="text-sm text-gray-400">({movies.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>
                                <div className={grid}>
                                    {movies.map((work) => (
                                        <WorkCard
                                            key={work._slug}
                                            work={work}
                                            internalLink={getInternalLink(work)}
                                            poster={getPoster(work)}
                                            posterSlug={getMdlSlugForCard(work)}
                                            linkSlug={extractFullMdlSlug(work.title.link)}
                                            inWatchlist={isInWatchlist(work)}
                                            mdlRating={getCachedMdlRating(work)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {specials.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-emerald-500 to-teal-500 rounded-full" />
                                    <Tv className="h-5 w-5 text-emerald-400" />
                                    <h3 className="text-lg font-semibold text-white">Specials</h3>
                                    <span className="text-sm text-gray-400">({specials.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>
                                <div className={grid}>
                                    {specials.map((work) => (
                                        <WorkCard
                                            key={work._slug}
                                            work={work}
                                            internalLink={getInternalLink(work)}
                                            poster={getPoster(work)}
                                            posterSlug={getMdlSlugForCard(work)}
                                            linkSlug={extractFullMdlSlug(work.title.link)}
                                            inWatchlist={isInWatchlist(work)}
                                            mdlRating={getCachedMdlRating(work)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {dramas.length === 0 && movies.length === 0 && specials.length === 0 && (
                            <div className="text-center py-12 text-gray-400">No filmography information available.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
