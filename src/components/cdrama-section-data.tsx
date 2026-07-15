import { mediaService } from "@/services/media.service";
import { getWatchlistExternalIds } from "@/actions/user-media";
import { getHomeExcludedTags } from "@/actions/preferences";
import { HomeSectionHeader } from "@/components/home-section-header";
import { DramaRow, mdlSlugFromUrl, nextEpisodeCacheKey, type NextEpisodeMap } from "@/components/drama-row";
import { getCachedNextEpisodesByMediaId } from "@/lib/next-episode-cache";
import { prefillNextEpisodes } from "@/lib/next-episode-fetch";
import { prisma } from "@/lib/prisma";

export async function CDramaSectionData() {
    const excludedTags = await getHomeExcludedTags();
    const excludeParam = excludedTags.map((t) => t.id).join(",") || undefined;
    // "See more" links carry the same exclusions/sort as the home lists to /dramas
    const homeFilterParams = excludeParam
        ? `&tag_exclude=${excludeParam}&tag_exclude_name=${encodeURIComponent(excludedTags.map((t) => t.name).join("|"))}`
        : "";

    const [cdramas, watchlistExternalIds] = await Promise.all([mediaService.getCDramas(excludeParam), getWatchlistExternalIds()]);
    const watchlistIds = new Set(watchlistExternalIds);

    // Batch-look up which MDL slugs are already linked to a TMDB entry in the cache
    const allShows = [...cdramas.trending, ...cdramas.airing, ...cdramas.upcoming];
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
    const airingLookups = cdramas.airing.map((m) => {
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
            <div className="absolute -top-24 left-0 w-72 md:w-120 h-72 md:h-120 bg-rose-500/6 rounded-full blur-[100px] md:blur-[160px] -z-10 pointer-events-none" />

            <HomeSectionHeader
                eyebrow="China"
                title="C-Drama Universe"
                subtitle="Fresh from China · Trending, airing, and upcoming series"
                accent="rose"
                live
            />

            <div className="space-y-3 md:space-y-5">
                <DramaRow
                    items={cdramas.trending}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-rose-400"
                    accentText="text-rose-400"
                    label="Top Rated"
                    seeMoreHref={`/dramas?category=popular&country=CN${homeFilterParams}`}
                    variant="spotlight"
                    leadKicker="#1 Top Rated"
                />
                <DramaRow
                    items={cdramas.airing}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-violet-400"
                    label="Airing Now"
                    seeMoreHref={`/dramas?category=airing&country=CN&sort=popular${homeFilterParams}`}
                    variant="backdrop"
                    nextEpisodes={nextEpisodes}
                />
                <DramaRow
                    items={cdramas.upcoming}
                    linkedBySlug={linkedBySlug}
                    watchlistIds={watchlistIds}
                    accentClass="bg-amber-400"
                    accentText="text-amber-400"
                    label="Coming Soon"
                    seeMoreHref={`/dramas?category=upcoming&country=CN&sort=popular${homeFilterParams}`}
                    variant="spotlight"
                    leadKicker="Most Anticipated"
                />
            </div>
        </section>
    );
}
