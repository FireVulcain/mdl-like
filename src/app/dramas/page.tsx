import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { mediaService, UnifiedMedia } from "@/services/media.service";
import { getMdlRatingsForTmdbIds } from "@/actions/person";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
    category?: string;
    country?: string;
    sort?: string;
    genres?: string;
    year?: string;
    page?: string;
}>;

const CATEGORY_CONFIG = {
    popular: {
        label: "All",
        accent: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
        bar: "from-blue-500 to-blue-400",
        dot: "bg-blue-400",
    },
    airing: {
        label: "Airing Now",
        accent: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        bar: "from-emerald-500 to-emerald-400",
        dot: "bg-emerald-400",
    },
    upcoming: {
        label: "Coming Soon",
        accent: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
        bar: "from-amber-500 to-amber-400",
        dot: "bg-amber-400",
    },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

const COUNTRY_OPTIONS = [
    { value: "all", label: "All" },
    { value: "KR", label: "Korean" },
    { value: "CN", label: "Chinese" },
];

// TMDB sort options (used when country=all)
const TMDB_SORT_OPTIONS = [
    { value: "vote_average.desc", label: "Top Rated" },
    { value: "popularity.desc", label: "Most Popular" },
    { value: "first_air_date.desc", label: "Newest First" },
    { value: "first_air_date.asc", label: "Oldest First" },
];

// MDL/Kuryana sort options (used when country=KR or CN)
const MDL_SORT_OPTIONS = [
    { value: "top", label: "Top Rated" },
    { value: "popular", label: "Most Popular" },
];

const TMDB_GENRES = [
    { id: "18", label: "Drama" },
    { id: "35", label: "Comedy" },
    { id: "80", label: "Crime" },
    { id: "10759", label: "Action & Adventure" },
    { id: "9648", label: "Mystery" },
    { id: "10765", label: "Sci-Fi & Fantasy" },
    { id: "10751", label: "Family" },
    { id: "10768", label: "War & Politics" },
    { id: "16", label: "Animation" },
    { id: "99", label: "Documentary" },
    { id: "37", label: "Western" },
];

function buildUrl(base: Record<string, string>, overrides: Record<string, string | null | undefined>) {
    const params = { ...base };
    for (const [key, value] of Object.entries(overrides)) {
        if (value === null || value === undefined) {
            delete params[key];
        } else {
            params[key] = value;
        }
    }
    return `/dramas?${new URLSearchParams(params).toString()}`;
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
    return pages;
}

export default async function DramasPage({ searchParams }: { searchParams: SearchParams }) {
    const { category: rawCategory, country: rawCountry, sort: rawSort, genres: rawGenres, year, page: rawPage } = await searchParams;

    const category: Category = (rawCategory as Category) in CATEGORY_CONFIG ? (rawCategory as Category) : "popular";
    const country = rawCountry ?? "all";
    const sort = rawSort ?? "popularity.desc";
    const page = Math.max(1, parseInt(rawPage ?? "1", 10));

    const selectedGenres = rawGenres ? rawGenres.split(",").filter(Boolean) : ["18"];
    const genresParam = selectedGenres.join(",");

    // MDL mode when country is KR or CN
    const isMdlMode = country === "KR" || country === "CN";

    // Effective sort value for MDL mode
    const mdlSort = sort === "popular" ? "popular" : "top";

    // Fetch data
    let items: UnifiedMedia[] = [];
    let totalPages = 1;
    let totalResults = 0;
    let hasNextPage = false;

    if (isMdlMode) {
        const result = await mediaService.browseDramasMDL({
            country: country as "KR" | "CN",
            category,
            sort: mdlSort,
            page,
        });
        items = result.items;
        hasNextPage = result.hasNextPage;
        totalPages = hasNextPage ? page + 1 : page;
    } else {
        const result = await mediaService.browseDramas({
            category,
            country,
            sort,
            genres: genresParam,
            year,
            page,
        });
        items = result.items;
        totalPages = result.totalPages;
        totalResults = result.totalResults;
    }

    // For TMDB items, fetch MDL ratings overlay
    const mdlRatingsMap: Record<string, number | undefined> = {};
    if (!isMdlMode) {
        const tmdbIds = items.filter((i) => i.id.startsWith("tmdb-")).map((i) => i.externalId);
        const ratings = await getMdlRatingsForTmdbIds(tmdbIds);
        Object.assign(mdlRatingsMap, ratings);
    }

    // For MDL items, look up which slugs are already linked to a TMDB entry
    let linkedBySlug = new Map<string, string>();
    if (isMdlMode && items.length > 0) {
        const slugs = items.map((m) => m.id.replace(/^mdl-/, ""));
        const linkedRows = await prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true },
        });
        linkedBySlug = new Map(linkedRows.map((r) => [r.mdlSlug, r.tmdbExternalId]));
    }

    const baseParams: Record<string, string> = { category, country, sort, genres: genresParam };
    if (year) baseParams.year = year;
    baseParams.page = page.toString();

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 17 }, (_, i) => currentYear - i);
    const catConfig = CATEGORY_CONFIG[category];
    const pageNumbers = generatePageNumbers(page, totalPages);

    function genreToggleUrl(genreId: string) {
        const next = selectedGenres.includes(genreId) ? selectedGenres.filter((g) => g !== genreId) : [...selectedGenres, genreId];
        return buildUrl(baseParams, { genres: next.length > 0 ? next.join(",") : null, page: "1" });
    }

    return (
        <div className="relative min-h-screen">
            {/* Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
                <div className="absolute -bottom-40 -right-40 w-125 h-125 bg-blue-500/12 rounded-full blur-[180px]" />
            </div>

            <div className="container py-6 md:py-10 max-w-[95%] md:max-w-[90%] mx-auto px-2 md:px-0 relative z-10">
                {/* Breadcrumb */}
                <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-6 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <div className={`w-1 h-7 bg-linear-to-b ${catConfig.bar} rounded-full`} />
                        <h1 className="text-2xl md:text-3xl font-bold text-white">K-Drama Universe</h1>
                    </div>
                    <p className="text-sm text-gray-400 ml-4">Korean &amp; Chinese dramas</p>
                </div>

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                    {/* Left: Grid + Pagination */}
                    <main className="flex-1 min-w-0 w-full">
                        {/* Results meta */}
                        <div className="flex items-center justify-between mb-5">
                            {isMdlMode ? (
                                <p className="text-sm text-gray-400">
                                    Page <span className="text-white font-medium">{page}</span> · MDL data
                                </p>
                            ) : (
                                <p className="text-sm text-gray-400">
                                    <span className="text-white font-medium">{totalResults.toLocaleString()}</span> shows found
                                </p>
                            )}
                            {!isMdlMode && totalPages > 1 && (
                                <p className="text-xs text-gray-500">
                                    Page {page} of {totalPages}
                                </p>
                            )}
                        </div>

                        {/* Grid */}
                        {items.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
                                {items.map((media) => {
                                    if (isMdlMode) {
                                        const slug = media.id.replace(/^mdl-/, "");
                                        const tmdbExternalId = linkedBySlug.get(slug);
                                        const href = tmdbExternalId
                                            ? `/media/tmdb-${tmdbExternalId}`
                                            : `https://mydramalist.com/${slug}`;
                                        const overlay = !tmdbExternalId ? (
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <LinkToTmdbButton mdlSlug={slug} defaultQuery={media.title} compact />
                                            </div>
                                        ) : undefined;
                                        return (
                                            <MediaCard
                                                key={media.id}
                                                media={media}
                                                mdlRating={media.rating || undefined}
                                                href={href}
                                                overlay={overlay}
                                                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
                                            />
                                        );
                                    }
                                    return (
                                        <MediaCard
                                            key={media.id}
                                            media={media}
                                            mdlRating={media.id.startsWith("tmdb-") ? mdlRatingsMap[media.externalId] : undefined}
                                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 33vw, 25vw"
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-24 text-gray-500">No shows found for the selected filters.</div>
                        )}

                        {/* Pagination */}
                        {isMdlMode ? (
                            (page > 1 || hasNextPage) && (
                                <div className="flex items-center justify-center gap-3 mt-10">
                                    <Link
                                        href={buildUrl(baseParams, { page: Math.max(1, page - 1).toString() })}
                                        aria-disabled={page <= 1}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                            page <= 1
                                                ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Link>
                                    <span className="text-sm text-gray-500">Page {page}</span>
                                    <Link
                                        href={buildUrl(baseParams, { page: (page + 1).toString() })}
                                        aria-disabled={!hasNextPage}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                            !hasNextPage
                                                ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            )
                        ) : (
                            totalPages > 1 && (
                                <div className="flex items-center justify-center gap-1.5 mt-10">
                                    <Link
                                        href={buildUrl(baseParams, { page: Math.max(1, page - 1).toString() })}
                                        aria-disabled={page <= 1}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                            page <= 1
                                                ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Prev
                                    </Link>

                                    <div className="flex items-center gap-1">
                                        {pageNumbers.map((p, i) =>
                                            p === "..." ? (
                                                <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-gray-500">
                                                    ...
                                                </span>
                                            ) : (
                                                <Link
                                                    key={p}
                                                    href={buildUrl(baseParams, { page: p.toString() })}
                                                    className={`min-w-9 px-2 py-2 rounded-lg text-sm font-medium text-center transition-all border ${
                                                        p === page
                                                            ? "bg-white/15 text-white border-white/25"
                                                            : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                                                    }`}
                                                >
                                                    {p}
                                                </Link>
                                            )
                                        )}
                                    </div>

                                    <Link
                                        href={buildUrl(baseParams, { page: Math.min(totalPages, page + 1).toString() })}
                                        aria-disabled={page >= totalPages}
                                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-white/10 ${
                                            page >= totalPages
                                                ? "opacity-30 pointer-events-none bg-white/3 text-gray-500"
                                                : "bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </div>
                            )
                        )}
                    </main>

                    {/* Right: Filters sidebar */}
                    <aside className="w-full lg:w-52 xl:w-56 shrink-0 lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto space-y-5 bg-white/2 backdrop-blur-sm p-4 rounded-xl border border-white/5">
                        {/* Category */}
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Category</h4>
                            <div className="space-y-0.5">
                                {(Object.entries(CATEGORY_CONFIG) as [Category, (typeof CATEGORY_CONFIG)[Category]][]).map(([cat, config]) => (
                                    <Link
                                        key={cat}
                                        href={buildUrl(baseParams, { category: cat, page: "1" })}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                            category === cat ? "bg-white/8 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${category === cat ? config.dot : "bg-white/20"}`} />
                                        {config.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* Country */}
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Country</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {COUNTRY_OPTIONS.map((opt) => (
                                    <Link
                                        key={opt.value}
                                        href={buildUrl(baseParams, { country: opt.value, page: "1" })}
                                        className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                            country === opt.value
                                                ? "bg-white/15 text-white border border-white/25"
                                                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        {opt.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* Sort */}
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Sort by</h4>
                            <div className="space-y-0.5">
                                {(isMdlMode ? MDL_SORT_OPTIONS : TMDB_SORT_OPTIONS).map((opt) => {
                                    const isActive = isMdlMode ? mdlSort === opt.value : sort === opt.value;
                                    return (
                                        <Link
                                            key={opt.value}
                                            href={buildUrl(baseParams, { sort: opt.value, page: "1" })}
                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                                isActive ? "bg-white/8 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                            }`}
                                        >
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-white/70" : "bg-white/20"}`} />
                                            {opt.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Year (popular + TMDB only) */}
                        {!isMdlMode && category === "popular" && (
                            <>
                                <div className="h-px bg-white/5" />
                                <div className="space-y-1.5">
                                    <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Year</h4>
                                    <details className="group" open={!!year}>
                                        <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer list-none select-none text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                                            <span>{year ?? "All time"}</span>
                                            <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                                        </summary>
                                        <div className="mt-1 space-y-0.5">
                                            <Link
                                                href={buildUrl(baseParams, { year: null, page: "1" })}
                                                className={`flex px-3 py-1.5 rounded-lg text-xs transition-all ${
                                                    !year ? "bg-white/8 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                                }`}
                                            >
                                                All time
                                            </Link>
                                            {yearOptions.map((y) => (
                                                <Link
                                                    key={y}
                                                    href={buildUrl(baseParams, { year: y.toString(), page: "1" })}
                                                    className={`flex px-3 py-1.5 rounded-lg text-xs transition-all ${
                                                        year === y.toString()
                                                            ? "bg-white/8 text-white"
                                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                                    }`}
                                                >
                                                    {y}
                                                </Link>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            </>
                        )}

                        {/* Genre (TMDB only) */}
                        {!isMdlMode && (() => {
                            const nonDefaultSelected = selectedGenres.filter((g) => g !== "18");
                            const isNonDefault = nonDefaultSelected.length > 0 || selectedGenres.length === 0;
                            const activeLabels = TMDB_GENRES.filter((g) => selectedGenres.includes(g.id)).map((g) => g.label);
                            const summaryLabel =
                                activeLabels.length === 0 ? "Any" : activeLabels.length === 1 ? activeLabels[0] : `${activeLabels.length} genres`;
                            return (
                                <>
                                    <div className="h-px bg-white/5" />
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Genre</h4>
                                            {selectedGenres.length > 0 && (
                                                <Link
                                                    href={buildUrl(baseParams, { genres: null, page: "1" })}
                                                    className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                                                >
                                                    Clear
                                                </Link>
                                            )}
                                        </div>
                                        <details className="group" open={isNonDefault}>
                                            <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer list-none select-none text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                                                <span>{summaryLabel}</span>
                                                <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                                            </summary>
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                {TMDB_GENRES.map((genre) => {
                                                    const active = selectedGenres.includes(genre.id);
                                                    return (
                                                        <Link
                                                            key={genre.id}
                                                            href={genreToggleUrl(genre.id)}
                                                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                                                active
                                                                    ? "bg-white/15 text-white border border-white/25"
                                                                    : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                                                            }`}
                                                        >
                                                            {genre.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </details>
                                    </div>
                                </>
                            );
                        })()}
                    </aside>
                </div>
            </div>
        </div>
    );
}
