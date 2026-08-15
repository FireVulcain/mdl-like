import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Bookmark, ExternalLink, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { kuryanaGetPerson, mdlTitleFromLink, KuryanaWorkItem, KuryanaPersonResult } from "@/lib/kuryana";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { MdlPersonImage } from "@/components/media/mdl-person-image";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { MediaNav, NavSection } from "@/components/media/media-nav";
import { PersonPhotosSection } from "@/components/people/person-photos-section";
import { PersonThreadsSection } from "@/components/people/person-threads-section";
import { tmdb, TMDB_CONFIG } from "@/lib/tmdb";
import { getWatchlistExternalIds, getWatchlistPosters } from "@/actions/user-media";
import { BiographyExpander } from "@/components/media/biography-expander";
import { StickySidebar } from "@/components/media/sticky-sidebar";
import type { Metadata } from "next";
import { mdlPersonMetadata } from "@/lib/page-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    return mdlPersonMetadata((await params).slug);
}

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

// MDL's category names are singular; only the common ones get a plural worth
// writing down. Anything else — Producer, Narrator, "Screenwriter & Director" —
// reads fine as it comes and is shown verbatim rather than guessed at.
const CATEGORY_LABELS: Record<string, string> = {
    Drama: "Dramas",
    Movie: "Movies",
    "TV Show": "TV Shows",
    Special: "Specials",
};

// Acting credits first, in the order the page has always shown them, with the
// new TV Shows after Movies. Everything else follows alphabetically, so a
// category nobody anticipated still lands somewhere sensible.
const CATEGORY_ORDER = ["Drama", "Movie", "TV Show", "Special"];
function categoryRank(name: string): number {
    const index = CATEGORY_ORDER.indexOf(name);
    return index === -1 ? CATEGORY_ORDER.length : index;
}

function extractFullMdlSlug(link: string): string | null {
    const match = link.match(/mydramalist\.com\/(.+)$/);
    return match ? match[1] : null;
}

function WorkCard({
    work,
    internalLink,
    poster,
    linkSlug,
    inWatchlist,
    mdlRating,
}: {
    work: KuryanaWorkItem;
    internalLink: string | null;
    poster: string | null;
    linkSlug: string | null; // always set: drives the Link button
    inWatchlist: boolean;
    mdlRating?: number | null;
}) {
    // The person endpoint returns an empty title.name; fall back to the work's URL
    const title = work.title.name || mdlTitleFromLink(work.title.link);
    const year = typeof work.year === "number" ? work.year : "TBA";
    const character = work.role?.name || null;

    const card = (
        <div className="space-y-2">
            <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-white/5 transition-transform hover:scale-105">
                {poster ? (
                    <Image
                        unoptimized={true}
                        src={poster}
                        alt={title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">No Image</div>
                )}

                {/* Both values are MDL ratings — our cached one when the work is linked,
                    the scraped one otherwise — so both wear the site's MDL blue.
                    Yellow is reserved for TMDB ratings. */}
                {(() => {
                    const rating = mdlRating != null && mdlRating > 0 ? mdlRating : work.rating > 0 ? work.rating : null;
                    if (rating === null) return null;
                    return (
                        <div className="absolute left-1.5 top-1.5">
                            <Badge className="bg-sky-500/90 text-white text-xs px-1.5">
                                <Star className="h-3 w-3 mr-0.5 fill-current" />
                                {rating.toFixed(1)}
                            </Badge>
                        </div>
                    );
                })()}

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
                <p className="font-semibold text-sm leading-tight text-white group-hover:text-sky-400 transition-colors line-clamp-1">{title}</p>
                {character && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">as {character}</p>}
                <p className="text-xs text-gray-500 mt-0.5">
                    {year}
                    {work.episodes && work.episodes > 0
                        ? ` · ${work.episodes} ${work.episodes === 1 ? "episode" : "episodes"}`
                        : ""}
                </p>
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

    // Not linked to TMDB, but we have an MDL slug and therefore an /media/mdl-
    // page for it. Leaving these inert made the Link button the only thing on
    // the card that did anything, which read as a broken card rather than a
    // deliberate one. Link still wins the click: its handler already calls
    // preventDefault and stopImmediatePropagation, which is what lets /dramas
    // put the same button inside a linked card.
    return (
        <Link href={`/media/mdl-${linkSlug}`} className="group block">
            {card}
        </Link>
    );
}

// Check DB cache first (7-day TTL) — avoids a live Kuryana call on every page visit.
// Outside the component on purpose: reading the clock during render is impure, and
// the React Compiler's lint says so the moment it can see into this file.
const PERSON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Rows cached before the scraper started returning a poster per work have none,
 * and would keep showing "No Image" until their TTL ran out. Treating that as
 * stale refetches them once; the check costs nothing and stops mattering as soon
 * as every row has been refreshed.
 *
 * Only conclusive when there are works to look at — a person with an empty
 * filmography must not be refetched on every view.
 */
function missingWorkImages(data: KuryanaPersonResult["data"]): boolean {
    const works = Object.values(data?.works ?? {}).flat();
    return works.length > 0 && !works.some((work) => work?.title?.image);
}

async function loadPerson(slug: string): Promise<KuryanaPersonResult["data"] | null> {
    const staleAt = new Date(Date.now() - PERSON_CACHE_TTL_MS);
    const cachedRow = await prisma.cachedKuryanaPerson.findUnique({ where: { slug } });
    if (cachedRow && cachedRow.cachedAt > staleAt) {
        const cached = cachedRow.dataJson as KuryanaPersonResult["data"];
        if (!missingWorkImages(cached)) return cached;
    }

    const fetched = await kuryanaGetPerson(slug);
    const data = fetched?.data ?? null;
    if (data) {
        await prisma.cachedKuryanaPerson.upsert({
            where: { slug },
            create: { slug, dataJson: data as unknown as Prisma.InputJsonValue },
            update: { dataJson: data as unknown as Prisma.InputJsonValue, cachedAt: new Date() },
        });
    }
    return data;
}

export default async function MdlPersonPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    const data = await loadPerson(slug);
    if (!data) notFound();
    const details = data.details ?? {};

    // Every category MDL returned, not a fixed three. "TV Show" alone is over a
    // thousand works across the cached people and was invisible; Producer,
    // Director and Narrator turn up too. The scraper already merges same-named
    // tables into one key, which is what fixed the split "Drama" columns — this
    // reads those keys and adds nothing back.
    const categories = Object.entries(data.works ?? {})
        .filter((entry): entry is [string, KuryanaWorkItem[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([name, works]) => ({
            name,
            label: CATEGORY_LABELS[name] ?? name,
            anchor: `section-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
            works: sortWorks(works),
        }))
        .sort((a, b) => categoryRank(a.name) - categoryRank(b.name) || a.name.localeCompare(b.name));

    // Batch cross-reference all work items against our CachedMdlData
    const allWorks = categories.flatMap((c) => c.works);
    const mdlIds = allWorks.map((w) => extractMdlId(w._slug)).filter(Boolean) as string[];

    const [cached, seasonLinkRows, aliasRows] =
        mdlIds.length > 0
            ? await Promise.all([
                  prisma.cachedMdlData.findMany({
                      where: { OR: mdlIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
                      select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true },
                  }),
                  prisma.mdlSeasonLink.findMany({
                      where: { OR: mdlIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
                      select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true, season: true },
                  }),
                  prisma.mdlAlias.findMany({
                      where: { OR: mdlIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
                      select: { mdlSlug: true, tmdbExternalId: true },
                  }),
              ])
            : [[], [], []];

    const mdlToTmdb = new Map<string, string>(); // numericMdlId → tmdbExternalId
    const mdlSeasonMap = new Map<string, number>(); // numericMdlId → season number (season links only)
    const mdlRatingMap = new Map<string, number>(); // numericMdlId → mdlRating
    for (const item of cached) {
        const numericId = item.mdlSlug.split("-")[0];
        mdlToTmdb.set(numericId, item.tmdbExternalId);
        if (item.mdlRating != null) mdlRatingMap.set(numericId, item.mdlRating);
    }
    for (const item of seasonLinkRows) {
        const numericId = item.mdlSlug.split("-")[0];
        if (!mdlToTmdb.has(numericId)) mdlToTmdb.set(numericId, item.tmdbExternalId);
        mdlSeasonMap.set(numericId, item.season);
        if (item.mdlRating != null && !mdlRatingMap.has(numericId)) mdlRatingMap.set(numericId, item.mdlRating);
    }
    const aliasNumericIds = new Set<string>();
    for (const item of aliasRows) {
        const numericId = item.mdlSlug.split("-")[0];
        if (!mdlToTmdb.has(numericId)) mdlToTmdb.set(numericId, item.tmdbExternalId);
        aliasNumericIds.add(numericId);
        // aliases have no season param — they link directly to the main show page
    }

    // Batch-fetch TMDB posters for linked works (server-side, cached 1h by Next.js)
    type LinkedEntry = { mdlNumericId: string; tmdbExternalId: string; mediaType: "tv" | "movie"; hasMdlImage: boolean };
    const linkedEntries: LinkedEntry[] = [];
    const seenTmdbIds = new Set<string>();

    for (const category of categories) {
        for (const work of category.works) {
            // Crew credits name the format themselves; acting credits are filed
            // under it. Either way only a movie is a movie on TMDB.
            const mediaType = (work.type ?? category.name) === "Movie" ? "movie" : "tv";
            const id = extractMdlId(work._slug);
            if (!id || !mdlToTmdb.has(id)) continue;
            const tmdbId = mdlToTmdb.get(id)!;
            if (seenTmdbIds.has(tmdbId)) continue;
            seenTmdbIds.add(tmdbId);
            linkedEntries.push({ mdlNumericId: id, tmdbExternalId: tmdbId, mediaType, hasMdlImage: !!work.title?.image });
        }
    }

    // TMDB is the fallback now, not the default, so only the works MDL has no
    // image for are worth a request. In practice that is none of them: across
    // the cached filmographies the split is exactly 0% or 100% per person and
    // never anything between, and it falls on the date the scraper started
    // sending an image per work. The rows sitting at zero are the ones cached
    // before that, and missingWorkImages above already refetches them on sight.
    const needsTmdbPoster = linkedEntries.filter((entry) => !entry.hasMdlImage);

    const [tmdbDetails, watchlistExternalIds, pickedPosters] = await Promise.all([
        Promise.all(needsTmdbPoster.map(({ tmdbExternalId, mediaType }) => tmdb.getDetails(mediaType, tmdbExternalId).catch(() => null))),
        getWatchlistExternalIds(),
        getWatchlistPosters(),
    ]);
    const watchlistIds = new Set(watchlistExternalIds);

    // A poster chosen in the watchlist wins over TMDB's, the same rule the media
    // page applies. Keyed by season first, since a show tracked as several
    // seasons carries one per row, then by show for everything else.
    const pickedBySeason = new Map(pickedPosters.map((p) => [`${p.externalId}-${p.season}`, p.poster]));
    const pickedByShow = new Map<string, string>();
    for (const p of pickedPosters) if (p.poster && !pickedByShow.has(p.externalId)) pickedByShow.set(p.externalId, p.poster);

    const pickedMap = new Map<string, string>(); // numericMdlId → poster chosen by hand
    for (const { mdlNumericId, tmdbExternalId } of linkedEntries) {
        const season = mdlSeasonMap.get(mdlNumericId);
        const picked =
            (season != null ? pickedBySeason.get(`${tmdbExternalId}-${season}`) : null) ??
            pickedBySeason.get(`${tmdbExternalId}-1`) ??
            pickedByShow.get(tmdbExternalId) ??
            null;
        if (picked) pickedMap.set(mdlNumericId, picked);
    }

    const tmdbPosterMap = new Map<string, string>(); // numericMdlId → TMDB poster, fallback only
    needsTmdbPoster.forEach(({ mdlNumericId }, i) => {
        const path = tmdbDetails[i]?.poster_path;
        if (path) tmdbPosterMap.set(mdlNumericId, TMDB_CONFIG.w342Image(path));
    });

    function getPoster(work: KuryanaWorkItem): string | null {
        // MDL's own image first, on a page that is MDL's from top to bottom —
        // linking a work to TMDB used to change the artwork under it, so the same
        // filmography looked like two different lists depending on which entries
        // happened to be linked. TMDB only fills the gaps MDL leaves.
        //
        // A poster picked by hand in the watchlist still wins over both: that one
        // is a decision, not a default.
        const id = extractMdlId(work._slug);
        if (!id) return work.title.image ?? null;
        return pickedMap.get(id) ?? work.title.image ?? tmdbPosterMap.get(id) ?? null;
    }

    function getInternalLink(work: KuryanaWorkItem): string | null {
        const id = extractMdlId(work._slug);
        if (!id) return null;
        const tmdbId = mdlToTmdb.get(id);
        if (!tmdbId) return null;
        const season = mdlSeasonMap.get(id);
        return season ? `/media/tmdb-${tmdbId}?season=${season}` : `/media/tmdb-${tmdbId}`;
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
        if (mdlRatingMap.has(id)) return mdlRatingMap.get(id)!;
        // For alias items, work.rating IS the MDL rating — show it as blue
        if (aliasNumericIds.has(id) && work.rating > 0) return work.rating;
        return null;
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

    // Same jump strip as the media pages. Photos and Comments are streamed in,
    // so their anchors are rendered by this page rather than by the sections
    // themselves — the target has to exist before the scrape lands.
    const navSections: NavSection[] = [
        ...(bio ? [{ id: "section-biography", label: "Biography" }] : []),
        ...categories.map((c) => ({ id: c.anchor, label: c.label })),
        { id: "section-photos", label: "Photos" },
        { id: "section-comments", label: "Comments" },
    ];

    return (
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container py-8 space-y-8 m-auto px-4 md:px-6">
                <Link href="/" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>

                <div className="md:grid md:gap-8 md:grid-cols-[280px_1fr]">
                    {/* Mobile header: compact photo + name */}
                    <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                        <div className="relative aspect-2/3 overflow-hidden rounded-lg">
                            {data.profile ? (
                                <Image unoptimized src={data.profile} alt={data.name} fill className="object-cover" priority />
                            ) : (
                                <div className="flex h-full items-center justify-center bg-linear-to-br from-gray-800 to-gray-900 text-gray-400 text-xs">No Image</div>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 min-w-0 py-0.5">
                            <h1 className="text-base font-bold leading-snug text-white">{data.name}</h1>
                            <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-muted-foreground items-center">
                                <span className="text-gray-400">{allWorks.length} works</span>
                            </div>
                            <a
                                href={data.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                            >
                                View on MDL
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                    {/* Desktop sidebar: Photo + Info */}
                    <div className="hidden md:block">
                    <StickySidebar>
                        <MdlPersonImage src={data.profile ?? ""} alt={data.name} />

                        <div
                            className="relative overflow-hidden rounded-xl border border-white/10 p-6 shadow-lg space-y-3"
                            style={{
                                background: "rgba(17, 24, 39, 0.6)",
                                backdropFilter: "blur(20px)",
                                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -1px rgba(0,0,0,0.2), inset 0 1px 0 0 rgba(255,255,255,0.1)",
                            }}
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
                            <h3 className="font-display font-semibold text-lg text-white mb-4">Personal Info</h3>

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
                                        {/* A list of names, written as one. Every
                                            other row of this table is plain text;
                                            only this one was a run of chips. */}
                                        <p className="text-white">
                                            {alsoKnownAs.slice(0, 6).join(" · ")}
                                            {alsoKnownAs.length > 6 && (
                                                <span className="text-gray-500"> +{alsoKnownAs.length - 6} more</span>
                                            )}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </StickySidebar>
                    </div>

                    {/* Right: Name + Bio + Filmography */}
                    <div className="space-y-8 min-w-0 md:pt-6">
                        <div className="hidden md:block">
                            <h1 className="font-display text-4xl font-bold mb-2 text-white">{data.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                                <span className="text-gray-400">{allWorks.length} works</span>
                                <span className="text-gray-500">·</span>
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

                        <MediaNav sections={navSections} />

                        {bio && (
                            <div id="section-biography">
                                <h3 className="font-display text-lg font-semibold mb-3 text-white">Biography</h3>
                                <BiographyExpander text={bio} />
                            </div>
                        )}

                        <div className="h-px bg-white/8" />

                        {categories.map((category) => (
                            <div key={category.name} id={category.anchor} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-display text-lg font-semibold text-white">{category.label}</h3>
                                    <span className="text-sm text-gray-400">({category.works.length})</span>
                                    <div className="flex-1 h-px bg-white/8" />
                                </div>
                                <div className={grid}>
                                    {category.works.map((work) => (
                                        <WorkCard
                                            key={work._slug}
                                            work={work}
                                            internalLink={getInternalLink(work)}
                                            poster={getPoster(work)}
                                            linkSlug={extractFullMdlSlug(work.title.link)}
                                            inWatchlist={isInWatchlist(work)}
                                            mdlRating={getCachedMdlRating(work)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {categories.length === 0 && (
                            <div className="text-center py-12 text-gray-400">No filmography information available.</div>
                        )}

                        {/* Both streamed in so a slow scrape never holds up the
                            filmography. Photos sit after it: someone opens an actor
                            to see what they have been in, not to browse stills. */}
                        <div id="section-photos">
                            <Suspense fallback={null}>
                                <PersonPhotosSection slug={slug} />
                            </Suspense>
                        </div>

                        <div id="section-comments">
                            <Suspense fallback={null}>
                                <PersonThreadsSection slug={slug} />
                            </Suspense>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
