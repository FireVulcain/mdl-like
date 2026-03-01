import React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { mediaService, UnifiedMedia } from "@/services/media.service";
import { prisma } from "@/lib/prisma";

type SearchParams = Promise<{
    category?: string;
    country?: string;
    sort?: string;
    page?: string;
    genre?: string;
    year_from?: string;
    year_to?: string;
    rating_min?: string;
}>;

const CATEGORY_CONFIG = {
    popular: {
        label: "All",
        bar: "from-blue-500 to-blue-400",
        dot: "bg-blue-400",
    },
    airing: {
        label: "Airing Now",
        bar: "from-emerald-500 to-emerald-400",
        dot: "bg-emerald-400",
    },
    upcoming: {
        label: "Coming Soon",
        bar: "from-amber-500 to-amber-400",
        dot: "bg-amber-400",
    },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

const COUNTRY_OPTIONS = [
    { value: "all", label: "All" },
    { value: "KR", label: "Korean" },
    { value: "CN", label: "Chinese" },
    { value: "JP", label: "Japanese" },
    { value: "TH", label: "Thai" },
    { value: "TW", label: "Taiwanese" },
    { value: "HK", label: "Hong Kong" },
    { value: "PH", label: "Philippine" },
    { value: "SG", label: "Singaporean" },
];

const MDL_SORT_OPTIONS = [
    { value: "top", label: "Top Rated" },
    { value: "popular", label: "Most Popular" },
];

const MDL_GENRES = [
    { value: "action", label: "Action" },
    { value: "adventure", label: "Adventure" },
    { value: "animals", label: "Animals" },
    { value: "business", label: "Business" },
    { value: "comedy", label: "Comedy" },
    { value: "crime", label: "Crime" },
    { value: "detective", label: "Detective" },
    { value: "documentary", label: "Documentary" },
    { value: "drama", label: "Drama" },
    { value: "family", label: "Family" },
    { value: "fantasy", label: "Fantasy" },
    { value: "food", label: "Food" },
    { value: "friendship", label: "Friendship" },
    { value: "historical", label: "Historical" },
    { value: "horror", label: "Horror" },
    { value: "investigation", label: "Investigation" },
    { value: "law", label: "Law" },
    { value: "life", label: "Life" },
    { value: "manga", label: "Manga" },
    { value: "martial_arts", label: "Martial Arts" },
    { value: "mature", label: "Mature" },
    { value: "medical", label: "Medical" },
    { value: "melodrama", label: "Melodrama" },
    { value: "military", label: "Military" },
    { value: "music", label: "Music" },
    { value: "mystery", label: "Mystery" },
    { value: "political", label: "Political" },
    { value: "psychological", label: "Psychological" },
    { value: "romance", label: "Romance" },
    { value: "school", label: "School" },
    { value: "sci_fi", label: "Sci-Fi" },
    { value: "sitcom", label: "Sitcom" },
    { value: "sports", label: "Sports" },
    { value: "supernatural", label: "Supernatural" },
    { value: "suspense", label: "Suspense" },
    { value: "thriller", label: "Thriller" },
    { value: "tokusatsu", label: "Tokusatsu" },
    { value: "tragedy", label: "Tragedy" },
    { value: "vampire", label: "Vampire" },
    { value: "war", label: "War" },
    { value: "western", label: "Western" },
    { value: "wuxia", label: "Wuxia" },
    { value: "youth", label: "Youth" },
    { value: "zombies", label: "Zombies" },
];

const RATING_MIN_OPTIONS = [
    { value: "", label: "Any" },
    { value: "7", label: "7.0+" },
    { value: "7.5", label: "7.5+" },
    { value: "8", label: "8.0+" },
    { value: "8.5", label: "8.5+" },
    { value: "9", label: "9.0+" },
];

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 1990 + 1 }, (_, i) => currentYear - i);

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

export default async function DramasPage({ searchParams }: { searchParams: SearchParams }) {
    const {
        category: rawCategory,
        country: rawCountry,
        sort: rawSort,
        page: rawPage,
        genre: rawGenre,
        year_from: rawYearFrom,
        year_to: rawYearTo,
        rating_min: rawRatingMin,
    } = await searchParams;

    const category: Category = (rawCategory as Category) in CATEGORY_CONFIG ? (rawCategory as Category) : "popular";
    const country = rawCountry ?? "all";
    const sort = rawSort ?? "top";
    const page = Math.max(1, parseInt(rawPage ?? "1", 10));
    const genre = rawGenre ?? "";
    const year_from = rawYearFrom ? parseInt(rawYearFrom, 10) : undefined;
    const year_to = rawYearTo ? parseInt(rawYearTo, 10) : undefined;
    const rating_min = rawRatingMin ? parseFloat(rawRatingMin) : undefined;

    const mdlSort = sort === "popular" ? "popular" : "top";

    const selectedGenres = genre ? genre.split(",").filter(Boolean) : [];

    const result = await mediaService.browseDramasMDL({
        country,
        category,
        sort: mdlSort,
        page,
        genre: selectedGenres.length > 0 ? selectedGenres.join(",") : undefined,
        year_from,
        year_to,
        rating_min,
    });
    const items: UnifiedMedia[] = result.items;
    const hasNextPage = result.hasNextPage;

    // Look up which MDL slugs are already linked to a TMDB entry
    let linkedBySlug = new Map<string, string>();
    if (items.length > 0) {
        const slugs = items.map((m) => m.id.replace(/^mdl-/, ""));
        const linkedRows = await prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true },
        });
        linkedBySlug = new Map(linkedRows.map((r) => [r.mdlSlug, r.tmdbExternalId]));
    }

    // Build base params for URL construction (only include active filters)
    const baseParams: Record<string, string> = { category, country, sort };
    if (genre) baseParams.genre = genre;
    if (rawYearFrom) baseParams.year_from = rawYearFrom;
    if (rawYearTo) baseParams.year_to = rawYearTo;
    if (rawRatingMin) baseParams.rating_min = rawRatingMin;
    baseParams.page = page.toString();

    const catConfig = CATEGORY_CONFIG[category];

    function genreToggleUrl(genreValue: string) {
        const next = selectedGenres.includes(genreValue)
            ? selectedGenres.filter((g) => g !== genreValue)
            : [...selectedGenres, genreValue];
        return buildUrl(baseParams, { genre: next.length > 0 ? next.join(",") : null, page: "1" });
    }

    const hasActiveFilters = selectedGenres.length > 0 || rawYearFrom || rawYearTo || rawRatingMin;

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
                    <p className="text-sm text-gray-400 ml-4">Asian dramas · Powered by MDL</p>
                </div>

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                    {/* Left: Grid + Pagination */}
                    <main className="flex-1 min-w-0 w-full">
                        {/* Results meta */}
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-sm text-gray-400">
                                Page <span className="text-white font-medium">{page}</span> · MDL data
                            </p>
                            {hasActiveFilters && (
                                <Link
                                    href={buildUrl({ category, country, sort }, { page: "1" })}
                                    className="text-xs text-gray-500 hover:text-white transition-colors"
                                >
                                    Clear filters
                                </Link>
                            )}
                        </div>

                        {/* Grid */}
                        {items.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-5">
                                {items.map((media) => {
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
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-24 text-gray-500">No shows found for the selected filters.</div>
                        )}

                        {/* Pagination — prev/next (total pages unknown from MDL API) */}
                        {(page > 1 || hasNextPage) && (
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
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
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
                                {MDL_SORT_OPTIONS.map((opt) => (
                                    <Link
                                        key={opt.value}
                                        href={buildUrl(baseParams, { sort: opt.value, page: "1" })}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                            mdlSort === opt.value ? "bg-white/8 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${mdlSort === opt.value ? "bg-white/70" : "bg-white/20"}`} />
                                        {opt.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* Genre */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Genre</h4>
                                {selectedGenres.length > 0 && (
                                    <Link
                                        href={buildUrl(baseParams, { genre: null, page: "1" })}
                                        className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                                    >
                                        Clear
                                    </Link>
                                )}
                            </div>
                            <details className="group" open={selectedGenres.length > 0}>
                                <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer list-none select-none text-gray-300 hover:text-white hover:bg-white/5 transition-all">
                                    <span>
                                        {selectedGenres.length === 0
                                            ? "Any"
                                            : selectedGenres.length === 1
                                              ? MDL_GENRES.find((g) => g.value === selectedGenres[0])?.label ?? selectedGenres[0]
                                              : `${selectedGenres.length} genres`}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-1.5 flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                                    {MDL_GENRES.map((g) => {
                                        const active = selectedGenres.includes(g.value);
                                        return (
                                            <Link
                                                key={g.value}
                                                href={genreToggleUrl(g.value)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                                    active
                                                        ? "bg-white/15 text-white border border-white/25"
                                                        : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                                                }`}
                                            >
                                                {g.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </details>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* Year range */}
                        <div className="space-y-1.5">
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Year</h4>
                            <div className="flex gap-1.5 items-center">
                                <details className="group flex-1">
                                    <summary className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer list-none select-none text-gray-300 hover:text-white hover:bg-white/5 transition-all border border-white/10">
                                        <span>{rawYearFrom ?? "From"}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute z-20 mt-1 w-28 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        <Link
                                            href={buildUrl(baseParams, { year_from: null, page: "1" })}
                                            className={`block px-3 py-1.5 text-xs transition-all ${!rawYearFrom ? "text-white bg-white/8" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            Any
                                        </Link>
                                        {YEAR_OPTIONS.map((y) => (
                                            <Link
                                                key={y}
                                                href={buildUrl(baseParams, { year_from: y.toString(), page: "1" })}
                                                className={`block px-3 py-1.5 text-xs transition-all ${
                                                    rawYearFrom === y.toString() ? "text-white bg-white/8" : "text-gray-400 hover:text-white hover:bg-white/5"
                                                }`}
                                            >
                                                {y}
                                            </Link>
                                        ))}
                                    </div>
                                </details>
                                <span className="text-gray-600 text-xs shrink-0">—</span>
                                <details className="group flex-1">
                                    <summary className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer list-none select-none text-gray-300 hover:text-white hover:bg-white/5 transition-all border border-white/10">
                                        <span>{rawYearTo ?? "To"}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute z-20 mt-1 w-28 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        <Link
                                            href={buildUrl(baseParams, { year_to: null, page: "1" })}
                                            className={`block px-3 py-1.5 text-xs transition-all ${!rawYearTo ? "text-white bg-white/8" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
                                        >
                                            Any
                                        </Link>
                                        {YEAR_OPTIONS.map((y) => (
                                            <Link
                                                key={y}
                                                href={buildUrl(baseParams, { year_to: y.toString(), page: "1" })}
                                                className={`block px-3 py-1.5 text-xs transition-all ${
                                                    rawYearTo === y.toString() ? "text-white bg-white/8" : "text-gray-400 hover:text-white hover:bg-white/5"
                                                }`}
                                            >
                                                {y}
                                            </Link>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        </div>

                        <div className="h-px bg-white/5" />

                        {/* Min Rating */}
                        <div className="space-y-2">
                            <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Min Rating</h4>
                            <div className="flex flex-wrap gap-1.5">
                                {RATING_MIN_OPTIONS.map((opt) => (
                                    <Link
                                        key={opt.value}
                                        href={buildUrl(baseParams, { rating_min: opt.value || null, page: "1" })}
                                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                            (rawRatingMin ?? "") === opt.value
                                                ? "bg-white/15 text-white border border-white/25"
                                                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        {opt.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                    </aside>
                </div>
            </div>
        </div>
    );
}
