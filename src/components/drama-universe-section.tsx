import { mediaService } from "@/services/media.service";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { getHomeExcludedTags, getDisplayPreferences } from "@/actions/preferences";
import { UnifiedMedia } from "@/services/media.service";
import { getNativeTitlesAndBackfill } from "@/lib/native-titles";
import { HomeSectionHeader } from "@/components/home-section-header";
import { DramaRow, mdlSlugFromUrl, nextEpisodeCacheKey, type NextEpisodeMap } from "@/components/drama-row";
import { getCachedNextEpisodesByMediaId } from "@/lib/next-episode-cache";
import { prefillNextEpisodes } from "@/lib/next-episode-fetch";
import { UNIVERSES } from "@/lib/home-preferences";
import { prisma } from "@/lib/prisma";

// One configurable "universe" (K-Drama, C-Drama, J-Drama…) — same layout for
// every country, driven by the UNIVERSES config and user's home sections.
export async function DramaUniverseSection({ country }: { country: string }) {
    const cfg = UNIVERSES[country];
    if (!cfg) return null;

    const [excludedTags, displayPrefs] = await Promise.all([getHomeExcludedTags(), getDisplayPreferences()]);
    const excludeParam = excludedTags.map((t) => t.id).join(",") || undefined;
    // "See more" links carry the same exclusions/sort as the home lists to /dramas
    const homeFilterParams = excludeParam
        ? `&tag_exclude=${excludeParam}&tag_exclude_name=${encodeURIComponent(excludedTags.map((t) => t.name).join("|"))}`
        : "";

    const [dramas, watchlistExternalIds] = await Promise.all([
        mediaService.getDramasByCountry(cfg.kuryana, country, excludeParam),
        getWatchlistExternalIds(),
    ]);
    const watchlistIds = new Set(watchlistExternalIds);

    // Title language preference. MDL's top lists don't carry native titles, so
    // they come from our own cache (filled progressively in the background by
    // scraping detail pages — a few per visit, stored permanently).
    if (displayPrefs.titleLanguage === "native") {
        const slugOf = (m: UnifiedMedia) => mdlSlugFromUrl(m.id.replace(/^mdl-/, ""));
        const all = [...dramas.trending, ...dramas.airing, ...dramas.upcoming];
        const nativeTitles = await getNativeTitlesAndBackfill(all.map(slugOf));

        const swap = (m: UnifiedMedia) => {
            const native = m.nativeTitle || nativeTitles.get(slugOf(m));
            return native ? { ...m, title: native } : m;
        };
        dramas.trending = dramas.trending.map(swap);
        dramas.airing = dramas.airing.map(swap);
        dramas.upcoming = dramas.upcoming.map(swap);
    }

    // Batch-look up which MDL slugs are already linked to a TMDB entry in the cache
    const allShows = [...dramas.trending, ...dramas.airing, ...dramas.upcoming];
    const slugs = allShows.map((m) => mdlSlugFromUrl(m.id.replace(/^mdl-/, "")));

    const [linkedRows, seasonRows, aliasRows] = await Promise.all([
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
    ]);
    const linkedBySlug = new Map<string, { tmdbExternalId: string; season?: number }>([
        ...linkedRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
        ...seasonRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season }] as const),
        ...aliasRows.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
    ]);

    // Next-episode dates for airing shows: serve from the DB cache, then
    // backfill misses AFTER the response (TMDB/TVmaze waterfall) so the next
    // page load has them without slowing this one down.
    const airingLookups = dramas.airing.map((m) => {
        const slug = mdlSlugFromUrl(m.id.replace(/^mdl-/, ""));
        return { cacheKey: nextEpisodeCacheKey(m, linkedBySlug), tmdbId: linkedBySlug.get(slug)?.tmdbExternalId, title: m.title };
    });
    const cachedEpisodes = await getCachedNextEpisodesByMediaId(airingLookups.map((l) => l.cacheKey));
    const nextEpisodes: NextEpisodeMap = new Map(
        [...cachedEpisodes].map(([key, v]) => [key, { airDate: v.airDate, episodeNumber: v.episodeNumber }]),
    );
    prefillNextEpisodes(airingLookups.filter((l) => !cachedEpisodes.has(l.cacheKey)));

    return (
        <section className="relative space-y-6 md:space-y-10">
            {/* Ambient glow anchored to the page, not a box */}
            <div className={`absolute -top-24 w-72 md:w-120 h-72 md:h-120 rounded-full blur-[100px] md:blur-[160px] -z-10 pointer-events-none ${cfg.glow}`} />

            <HomeSectionHeader eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} accent={cfg.accent} live />

            <div className="space-y-3 md:space-y-5">
                <DramaRow
                    items={dramas.trending}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass={cfg.accentBg}
                    accentText={cfg.accentText}
                    label="Top Rated"
                    seeMoreHref={`/dramas?category=popular&country=${country}${homeFilterParams}`}
                    variant="spotlight"
                    leadKicker="#1 Top Rated"
                />
                <DramaRow
                    items={dramas.airing}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass={cfg.airingBg}
                    label="Airing Now"
                    seeMoreHref={`/dramas?category=airing&country=${country}&sort=popular${homeFilterParams}`}
                    variant="backdrop"
                    nextEpisodes={nextEpisodes}
                />
                <DramaRow
                    items={dramas.upcoming}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-amber-400"
                    accentText="text-amber-400"
                    label="Coming Soon"
                    seeMoreHref={`/dramas?category=upcoming&country=${country}&sort=popular${homeFilterParams}`}
                    variant="spotlight"
                    leadKicker="Most Anticipated"
                />
            </div>
        </section>
    );
}
