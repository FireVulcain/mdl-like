import React, { Suspense } from "react";
import Link from "next/link";
import { Bookmark, Check, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MediaCard } from "@/components/media-card";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import { mediaService, UnifiedMedia } from "@/services/media.service";
import { prisma } from "@/lib/prisma";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { getExcludedTagsPreferences, getDisplayPreferences, getViewPreferences } from "@/actions/preferences";
import { getNativeTitlesAndBackfill } from "@/lib/native-titles";
import { RatingRangeFilter } from "@/components/dramas/rating-range-filter";
import { ClosingDetails } from "@/components/dramas/closing-details";
import { TagSearchFilter } from "@/components/dramas/tag-search-filter";
import { DramaListItem } from "@/components/dramas/drama-list-item";
import { DramasViewToggle } from "@/components/dramas/view-toggle";
import { PageBackground } from "@/components/page-background";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Browse Dramas",
    description: "Browse and filter dramas by genre, country, year and rating.",
};

type SearchParams = Promise<{
    category?: string;
    country?: string;
    sort?: string;
    page?: string;
    genre?: string;
    genre_exclude?: string;
    year_from?: string;
    year_to?: string;
    rating_min?: string;
    rating_max?: string;
    tag?: string;
    tag_name?: string;
    tag_exclude?: string;
    tag_exclude_name?: string;
    no_defaults?: string;
    view?: string;
}>;

const CATEGORY_CONFIG = {
    // value stays "popular" (it's in shared/bookmarked URLs); the scraper call
    // behind it only returns finished dramas, so the label says so
    popular: {
        label: "Completed",
        dot: "bg-blue-400",
    },
    airing: {
        label: "Airing Now",
        dot: "bg-emerald-400",
    },
    upcoming: {
        label: "Coming Soon",
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

// What one MDL page holds — the same number browseDramasMDL uses to decide
// whether another page follows.
const PAGE_SIZE = 20;

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
        genre_exclude: rawGenreExclude,
        year_from: rawYearFrom,
        year_to: rawYearTo,
        rating_min: rawRatingMin,
        rating_max: rawRatingMax,
        tag: rawTag,
        tag_name: rawTagName,
        tag_exclude: rawTagExclude,
        tag_exclude_name: rawTagExcludeName,
        no_defaults: rawNoDefaults,
        view: rawView,
    } = await searchParams;

    const excludedPrefs = await getExcludedTagsPreferences();

    const category: Category = (rawCategory as Category) in CATEGORY_CONFIG ? (rawCategory as Category) : "popular";
    // Several countries at once, comma-separated — the scraper merges them into
    // one ranked list. Empty means every country, so "all" is the absence of a
    // selection rather than an option sitting alongside the others.
    const country = rawCountry ?? "all";
    const selectedCountries = country
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c && c !== "all");
    const sort = rawSort ?? "top";
    const page = Math.max(1, parseInt(rawPage ?? "1", 10));
    const genre = rawGenre ?? "";
    const genreExclude = rawGenreExclude ?? "";
    const year_from = rawYearFrom ? parseInt(rawYearFrom, 10) : undefined;
    const year_to = rawYearTo ? parseInt(rawYearTo, 10) : undefined;
    const rating_min = rawRatingMin ? parseFloat(rawRatingMin) : undefined;
    const rating_max = rawRatingMax ? parseFloat(rawRatingMax) : undefined;
    const tag = rawTag ? parseInt(rawTag, 10) : undefined;
    // "list" is the MDL-shaped reading view. A ?view= param wins for the visit;
    // without one, the saved preference decides, so the switch survives leaving
    // the page rather than only riding on the URL.
    const view: "grid" | "list" =
        rawView === "list" || rawView === "grid" ? rawView : (await getViewPreferences()).dramasView;

    // Excluded tags: an explicit URL list always wins; otherwise, unless the
    // user lifted them for this visit (no_defaults=1), the Settings exclusions
    // apply when "also apply to browse" is enabled. Any filter interaction in
    // the panel writes the effective list into the URL, so no hidden state.
    // (tag_exclude is a raw string — supports comma-separated lists.)
    const hasBrowseDefaults = excludedPrefs.applyToBrowse && excludedPrefs.tags.length > 0;
    let tagExclude = rawTagExclude || undefined;
    let tagExcludeName = rawTagExcludeName;
    let excludedAreDefaults = false;
    if (!tagExclude && rawNoDefaults !== "1" && hasBrowseDefaults) {
        tagExclude = excludedPrefs.tags.map((t) => t.id).join(",");
        tagExcludeName = excludedPrefs.tags.map((t) => t.name).join("|");
        excludedAreDefaults = true;
    }

    const mdlSort = sort === "popular" ? "popular" : "top";

    const selectedGenres = genre ? genre.split(",").filter(Boolean) : [];
    const excludedGenres = genreExclude ? genreExclude.split(",").filter(Boolean) : [];

    const result = await mediaService.browseDramasMDL({
        country,
        category,
        sort: mdlSort,
        page,
        genre: selectedGenres.length > 0 ? selectedGenres.join(",") : undefined,
        genre_exclude: excludedGenres.length > 0 ? excludedGenres.join(",") : undefined,
        year_from,
        year_to,
        rating_min,
        rating_max,
        tag,
        tag_exclude: tagExclude,
    });
    let items: UnifiedMedia[] = result.items;

    // Display-only native titles (progressively cached from MDL detail pages)
    const displayPrefs = await getDisplayPreferences();
    if (displayPrefs.titleLanguage === "native" && items.length > 0) {
        const slugOf = (m: UnifiedMedia) => m.id.replace(/^mdl-/, "");
        const titles = await getNativeTitlesAndBackfill(items.map(slugOf));
        items = items.map((m) => {
            const native = m.nativeTitle || titles.get(slugOf(m));
            return native ? { ...m, title: native } : m;
        });
    }
    const hasNextPage = result.hasNextPage;

    // Look up which MDL slugs are already linked to a TMDB entry + fetch watchlist in parallel
    let linkedBySlug = new Map<string, { tmdbExternalId: string; season?: number }>();
    let watchlistIds = new Set<string>();
    if (items.length > 0) {
        const slugs = items.map((m) => m.id.replace(/^mdl-/, ""));
        const [linkedRows, seasonRows, aliasRows, watchlistExternalIds] = await Promise.all([
            prisma.cachedMdlData.findMany({
                where: { mdlSlug: { in: slugs } },
                select: { mdlSlug: true, tmdbExternalId: true },
            }),
            prisma.mdlSeasonLink.findMany({
                where: { mdlSlug: { in: slugs } },
                select: { mdlSlug: true, tmdbExternalId: true, season: true },
            }),
            prisma.mdlAlias.findMany({
                where: { mdlSlug: { in: slugs } },
                select: { mdlSlug: true, tmdbExternalId: true },
            }),
            getWatchlistExternalIds(),
        ]);
        linkedBySlug = new Map([
            ...linkedRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
            ...seasonRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season }] as const),
            ...aliasRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
        ]);
        watchlistIds = new Set(watchlistExternalIds);
    }

    // Build base params for URL construction (only include active filters)
    const baseParams: Record<string, string> = { category, country, sort };

    // Two names fit the summary line; past that the count reads better than a
    // truncated list that hides which ones are on.
    const countryLabel =
        selectedCountries.length === 0
            ? "All"
            : selectedCountries.length <= 2
              ? selectedCountries.map((c) => COUNTRY_OPTIONS.find((o) => o.value === c)?.label ?? c).join(", ")
              : `${selectedCountries.length} countries`;
    if (genre) baseParams.genre = genre;
    if (genreExclude) baseParams.genre_exclude = genreExclude;
    if (rawYearFrom) baseParams.year_from = rawYearFrom;
    if (rawYearTo) baseParams.year_to = rawYearTo;
    if (rawRatingMin) baseParams.rating_min = rawRatingMin;
    if (rawRatingMax) baseParams.rating_max = rawRatingMax;
    if (rawTag) { baseParams.tag = rawTag; if (rawTagName) baseParams.tag_name = rawTagName; }
    if (rawTagExclude) { baseParams.tag_exclude = rawTagExclude; if (rawTagExcludeName) baseParams.tag_exclude_name = rawTagExcludeName; }
    // Defaults stay implicit (reapplied server-side), but an explicit opt-out must survive navigation
    if (rawNoDefaults) baseParams.no_defaults = rawNoDefaults;
    // Written out even when it matches the saved default: every filter link is
    // built from these params, and an implicit view would flip mid-session if
    // the preference changed in another tab.
    baseParams.view = view;
    baseParams.page = page.toString();

    // Three-state toggle: neutral → include → exclude → neutral
    function genreToggleUrl(genreValue: string) {
        if (selectedGenres.includes(genreValue)) {
            // include → exclude
            const nextInclude = selectedGenres.filter((g) => g !== genreValue);
            const nextExclude = [...excludedGenres, genreValue];
            return buildUrl(baseParams, {
                genre: nextInclude.length > 0 ? nextInclude.join(",") : null,
                genre_exclude: nextExclude.join(","),
                page: "1",
            });
        } else if (excludedGenres.includes(genreValue)) {
            // exclude → neutral
            const nextExclude = excludedGenres.filter((g) => g !== genreValue);
            return buildUrl(baseParams, {
                genre_exclude: nextExclude.length > 0 ? nextExclude.join(",") : null,
                page: "1",
            });
        } else {
            // neutral → include
            return buildUrl(baseParams, { genre: [...selectedGenres, genreValue].join(","), page: "1" });
        }
    }

    const hasActiveFilters = selectedGenres.length > 0 || excludedGenres.length > 0 || rawYearFrom || rawYearTo || rawRatingMin || rawTag || tagExclude;

    return (
        <div className="relative min-h-screen">
            <PageBackground />

            <div className="container py-6 md:py-10 max-w-[95%] md:max-w-[90%] mx-auto px-2 md:px-0 relative z-10">
                {/* Breadcrumb */}
                <Link href="/" className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg mb-6 transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    Back to Home
                </Link>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="font-display text-3xl font-bold text-fg mb-1">Drama Library</h1>
                    <p className="text-sm text-fg-muted">Asian dramas · Powered by MDL</p>
                </div>

                {/* Two-column layout */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
                    {/* Left: Grid + Pagination */}
                    <main className="flex-1 min-w-0 w-full">
                        {/* Results meta */}
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <p className="text-sm text-fg-muted">
                                Page <span className="text-fg font-medium">{page}</span> · MDL data
                            </p>
                            <div className="flex items-center gap-3">
                                {hasActiveFilters && (
                                    <Link
                                        href={buildUrl({ category, country, sort, view }, { page: "1" })}
                                        className="text-xs text-fg-dim hover:text-fg transition-colors"
                                    >
                                        Clear filters
                                    </Link>
                                )}
                                <DramasViewToggle
                                    view={view}
                                    hrefFor={{
                                        grid: buildUrl(baseParams, { view: "grid" }),
                                        list: buildUrl(baseParams, { view: "list" }),
                                    }}
                                />
                            </div>
                        </div>

                        {/* Grid */}
                        {items.length > 0 ? (
                            view === "list" ? (
                            <div className="flex flex-col gap-3">
                                {items.map((media, index) => {
                                    const slug = media.id.replace(/^mdl-/, "");
                                    const entry = linkedBySlug.get(slug);
                                    const tmdbExternalId = entry?.tmdbExternalId;
                                    const href = tmdbExternalId
                                        ? `/media/tmdb-${tmdbExternalId}${entry?.season ? `?season=${entry.season}` : ""}`
                                        : `/media/mdl-${slug}`;
                                    return (
                                        <DramaListItem
                                            key={media.id}
                                            media={media}
                                            href={href}
                                            // Position in the list being read, the way MDL
                                            // numbers its own. The row's own `popularity`
                                            // is MDL's site-wide rank, which under a
                                            // filter counts in jumps and reads as noise.
                                            rank={(page - 1) * PAGE_SIZE + index + 1}
                                            inWatchlist={!!tmdbExternalId && watchlistIds.has(tmdbExternalId)}
                                            unlinkedSlug={tmdbExternalId ? undefined : slug}
                                        />
                                    );
                                })}
                            </div>
                            ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5 gap-4 md:gap-5">
                                {items.map((media) => {
                                    const slug = media.id.replace(/^mdl-/, "");
                                    const entry = linkedBySlug.get(slug);
                                    const tmdbExternalId = entry?.tmdbExternalId;
                                    const href = tmdbExternalId
                                        ? `/media/tmdb-${tmdbExternalId}${entry?.season ? `?season=${entry.season}` : ""}`
                                        : `/media/mdl-${slug}`;
                                    const inWatchlist = !!tmdbExternalId && watchlistIds.has(tmdbExternalId);
                                    const overlay = !tmdbExternalId ? (
                                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <LinkToTmdbButton mdlSlug={slug} defaultQuery={media.title} compact />
                                        </div>
                                    ) : inWatchlist ? (
                                        <div className="absolute bottom-1.5 left-1.5">
                                            <Badge className="bg-emerald-500/90 text-white backdrop-blur-sm px-1.5">
                                                <Bookmark className="h-3 w-3 fill-current" />
                                            </Badge>
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
                            )
                        ) : (
                            <div className="text-center py-24 text-fg-dim">No shows found for the selected filters.</div>
                        )}

                        {/* Pagination — prev/next (total pages unknown from MDL API) */}
                        {(page > 1 || hasNextPage) && (
                            <div className="flex items-center justify-center gap-3 mt-10">
                                <Link
                                    href={buildUrl(baseParams, { page: Math.max(1, page - 1).toString() })}
                                    aria-disabled={page <= 1}
                                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-line-strong ${
                                        page <= 1
                                            ? "opacity-30 pointer-events-none bg-surface-1 text-fg-dim"
                                            : "bg-surface-2 text-fg-soft hover:bg-surface-4 hover:text-fg"
                                    }`}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Prev
                                </Link>
                                <span className="text-sm text-fg-dim">Page {page}</span>
                                <Link
                                    href={buildUrl(baseParams, { page: (page + 1).toString() })}
                                    aria-disabled={!hasNextPage}
                                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all border border-line-strong ${
                                        !hasNextPage
                                            ? "opacity-30 pointer-events-none bg-surface-1 text-fg-dim"
                                            : "bg-surface-2 text-fg-soft hover:bg-surface-4 hover:text-fg"
                                    }`}
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            </div>
                        )}
                    </main>

                    {/* Right: Filters sidebar */}
                    <aside className="w-full lg:w-52 xl:w-75 shrink-0 space-y-5 bg-surface-1 backdrop-blur-sm p-4 rounded-xl border border-line-soft">
                        {/* Category */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Category</h4>
                            <div className="space-y-0.5">
                                {(Object.entries(CATEGORY_CONFIG) as [Category, (typeof CATEGORY_CONFIG)[Category]][]).map(([cat, config]) => (
                                    <Link
                                        key={cat}
                                        href={buildUrl(baseParams, { category: cat, page: "1" })}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                            category === cat ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2"
                                        }`}
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${category === cat ? config.dot : "bg-surface-4"}`} />
                                        {config.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-surface-2" />

                        {/* Country */}
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Country</h4>
                            <details className="group" open>
                                <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer list-none select-none text-fg-soft hover:text-fg hover:bg-surface-2 transition-all">
                                    <span>{countryLabel}</span>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-2 grid grid-cols-2 gap-x-1 gap-y-0.5">
                                    {COUNTRY_OPTIONS.map((opt) => {
                                        const isAll = opt.value === "all";
                                        const active = isAll ? selectedCountries.length === 0 : selectedCountries.includes(opt.value);
                                        // "All" clears rather than toggles; every other box adds or
                                        // removes itself, and emptying the list lands back on All.
                                        // Rebuilt in COUNTRY_OPTIONS order so the same selection
                                        // always produces the same URL, whatever order it was clicked.
                                        const toggled = active
                                            ? selectedCountries.filter((c) => c !== opt.value)
                                            : [...selectedCountries, opt.value];
                                        const ordered = isAll
                                            ? []
                                            : COUNTRY_OPTIONS.filter((o) => o.value !== "all" && toggled.includes(o.value)).map((o) => o.value);
                                        return (
                                            <Link
                                                key={opt.value}
                                                href={buildUrl(baseParams, {
                                                    country: ordered.length > 0 ? ordered.join(",") : "all",
                                                    page: "1",
                                                })}
                                                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs transition-all group/country hover:bg-surface-2"
                                            >
                                                <div
                                                    className={`w-3.5 h-3.5 rounded shrink-0 border flex items-center justify-center transition-all ${
                                                        active ? "bg-surface-4 border-line-strong" : "border-line-strong"
                                                    }`}
                                                >
                                                    {active && <Check className="h-2.5 w-2.5 text-fg" strokeWidth={3} />}
                                                </div>
                                                <span
                                                    className={`truncate ${active ? "text-fg" : "text-fg-muted group-hover/country:text-fg"}`}
                                                >
                                                    {opt.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </details>
                        </div>

                        <div className="h-px bg-surface-2" />

                        {/* Sort */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Sort by</h4>
                            <div className="space-y-0.5">
                                {MDL_SORT_OPTIONS.map((opt) => (
                                    <Link
                                        key={opt.value}
                                        href={buildUrl(baseParams, { sort: opt.value, page: "1" })}
                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                                            mdlSort === opt.value ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2"
                                        }`}
                                    >
                                        <div
                                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${mdlSort === opt.value ? "bg-fg/70" : "bg-surface-4"}`}
                                        />
                                        {opt.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-surface-2" />

                        {/* Genre */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Genre</h4>
                                {(selectedGenres.length > 0 || excludedGenres.length > 0) && (
                                    <Link
                                        href={buildUrl(baseParams, { genre: null, genre_exclude: null, page: "1" })}
                                        className="text-xs text-fg-dim hover:text-fg-soft transition-colors"
                                    >
                                        Clear ({selectedGenres.length + excludedGenres.length})
                                    </Link>
                                )}
                            </div>
                            <details className="group" open={selectedGenres.length > 0 || excludedGenres.length > 0}>
                                <summary className="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer list-none select-none text-fg-soft hover:text-fg hover:bg-surface-2 transition-all">
                                    <span>
                                        {selectedGenres.length === 0 && excludedGenres.length === 0
                                            ? "Any"
                                            : `${selectedGenres.length + excludedGenres.length} selected`}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mt-2 grid grid-cols-2 gap-x-1 gap-y-0.5">
                                    {MDL_GENRES.map((g) => {
                                        const included = selectedGenres.includes(g.value);
                                        const excluded = excludedGenres.includes(g.value);
                                        return (
                                            <Link
                                                key={g.value}
                                                href={genreToggleUrl(g.value)}
                                                title={included ? "Click to exclude" : excluded ? "Click to clear" : "Click to include"}
                                                className="flex items-center gap-1.5 px-1.5 py-1 rounded text-xs transition-all group/genre hover:bg-surface-2"
                                            >
                                                <div className={`w-3.5 h-3.5 rounded shrink-0 border flex items-center justify-center transition-all ${
                                                    included ? "bg-emerald-500/30 border-emerald-500/60" :
                                                    excluded ? "bg-red-500/30 border-red-500/60" :
                                                    "border-line-strong"
                                                }`}>
                                                    {included && <Check className="h-2.5 w-2.5 text-emerald-400" />}
                                                    {excluded && <X className="h-2.5 w-2.5 text-red-400" />}
                                                </div>
                                                <span className={`truncate ${included ? "text-emerald-400" : excluded ? "text-red-400" : "text-fg-muted group-hover/genre:text-fg"}`}>
                                                    {g.label}
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </details>
                        </div>

                        <div className="h-px bg-surface-2" />

                        {/* Tags */}
                        <Suspense fallback={null}>
                            <TagSearchFilter
                                activeTagId={rawTag}
                                activeTagName={rawTagName}
                                activeTagExcludeId={tagExclude}
                                activeTagExcludeName={tagExcludeName}
                                excludedAreDefaults={excludedAreDefaults}
                                hasBrowseDefaults={hasBrowseDefaults}
                            />
                        </Suspense>

                        <div className="h-px bg-surface-2" />

                        {/* Year range */}
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-fg-dim uppercase tracking-wider">Year</h4>
                            <div className="flex gap-1.5 items-center">
                                <ClosingDetails name="dramas-year" className="group flex-1">
                                    <summary className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer list-none select-none text-fg-soft hover:text-fg hover:bg-surface-2 transition-all border border-line-strong">
                                        <span>{rawYearFrom ?? "From"}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute z-20 mt-1 w-28 bg-[#1a1a2e] border border-line-strong rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        <Link
                                            href={buildUrl(baseParams, { year_from: null, page: "1" })}
                                            className={`block px-3 py-1.5 text-xs transition-all ${!rawYearFrom ? "text-fg bg-surface-3" : "text-fg-muted hover:text-fg hover:bg-surface-2"}`}
                                        >
                                            Any
                                        </Link>
                                        {YEAR_OPTIONS.map((y) => (
                                            <Link
                                                key={y}
                                                href={buildUrl(baseParams, { year_from: y.toString(), page: "1" })}
                                                className={`block px-3 py-1.5 text-xs transition-all ${
                                                    rawYearFrom === y.toString()
                                                        ? "text-fg bg-surface-3"
                                                        : "text-fg-muted hover:text-fg hover:bg-surface-2"
                                                }`}
                                            >
                                                {y}
                                            </Link>
                                        ))}
                                    </div>
                                </ClosingDetails>
                                <span className="text-fg-faint text-xs shrink-0">—</span>
                                <ClosingDetails name="dramas-year" className="group flex-1">
                                    <summary className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer list-none select-none text-fg-soft hover:text-fg hover:bg-surface-2 transition-all border border-line-strong">
                                        <span>{rawYearTo ?? "To"}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 transition-transform group-open:rotate-180" />
                                    </summary>
                                    <div className="absolute z-20 mt-1 w-28 bg-[#1a1a2e] border border-line-strong rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                        <Link
                                            href={buildUrl(baseParams, { year_to: null, page: "1" })}
                                            className={`block px-3 py-1.5 text-xs transition-all ${!rawYearTo ? "text-fg bg-surface-3" : "text-fg-muted hover:text-fg hover:bg-surface-2"}`}
                                        >
                                            Any
                                        </Link>
                                        {YEAR_OPTIONS.map((y) => (
                                            <Link
                                                key={y}
                                                href={buildUrl(baseParams, { year_to: y.toString(), page: "1" })}
                                                className={`block px-3 py-1.5 text-xs transition-all ${
                                                    rawYearTo === y.toString()
                                                        ? "text-fg bg-surface-3"
                                                        : "text-fg-muted hover:text-fg hover:bg-surface-2"
                                                }`}
                                            >
                                                {y}
                                            </Link>
                                        ))}
                                    </div>
                                </ClosingDetails>
                            </div>
                        </div>

                        <div className="h-px bg-surface-2" />

                        {/* Rating range. The six fixed "7.0+ / 7.5+ / 8.0+" pills
                            only ever set a floor; the scraper has always accepted a
                            ceiling too. The URL is still built here — the client
                            component just fills in the two values. */}
                        <RatingRangeFilter
                            key={`${rawRatingMin ?? ""}-${rawRatingMax ?? ""}`}
                            buildUrl={buildUrl(baseParams, { rating_min: "__MIN__", rating_max: "__MAX__", page: "1" })}
                            initialMin={rawRatingMin}
                            initialMax={rawRatingMax}
                        />
                    </aside>
                </div>
            </div>
        </div>
    );
}
