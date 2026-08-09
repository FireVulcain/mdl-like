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

    // Coming Soon premieres ride the very same machinery. MDL publishes an exact
    // date for roughly a third of upcoming shows, and when it does it lands in
    // next_episode_airing — the field this cache already holds. So the row costs
    // no extra query: it only lengthens the `in` clause below.
    //
    // mdlSlug is passed here (the airing lookups don't) so the waterfall starts
    // at MDL: TVmaze has no useful record of a drama that hasn't aired yet.
    //
    // Anything dated past next year is skipped — MDL won't have a day for it,
    // and without this those rows would be re-scraped on every visit forever.
    const cutoffYear = new Date().getFullYear() + 1;
    const upcomingLookups = dramas.upcoming
        .filter((m) => {
            const year = parseInt(m.year, 10);
            return !Number.isFinite(year) || year <= cutoffYear;
        })
        .map((m) => {
            const slug = mdlSlugFromUrl(m.id.replace(/^mdl-/, ""));
            return {
                cacheKey: nextEpisodeCacheKey(m, linkedBySlug),
                tmdbId: linkedBySlug.get(slug)?.tmdbExternalId,
                title: m.title,
                mdlSlug: slug,
            };
        });

    const episodeLookups = [...airingLookups, ...upcomingLookups];
    const cachedEpisodes = await getCachedNextEpisodesByMediaId(episodeLookups.map((l) => l.cacheKey));
    const nextEpisodes: NextEpisodeMap = new Map(
        [...cachedEpisodes].map(([key, v]) => [
            key,
            // airDateTime rides along: MDL knows the exact instant for a good
            // share of airing shows, and it is what the watchlist counts down
            // to — without it the two can land a day apart on the same show.
            { airDate: v.airDate, airDateTime: v.airDateTime, episodeNumber: v.episodeNumber },
        ]),
    );

    // Interleave the two queues rather than concatenating them. prefill only
    // takes the first few per request, and the airing row alone carries more
    // misses than that budget — shows TVmaze can't resolve stay missing and are
    // retried forever — so appending upcoming meant it never got a turn.
    const airingMisses = airingLookups.filter((l) => !cachedEpisodes.has(l.cacheKey));
    const upcomingMisses = upcomingLookups.filter((l) => !cachedEpisodes.has(l.cacheKey));
    const interleaved: (typeof airingMisses[number] | typeof upcomingMisses[number])[] = [];
    for (let i = 0; i < Math.max(airingMisses.length, upcomingMisses.length); i++) {
        if (airingMisses[i]) interleaved.push(airingMisses[i]);
        if (upcomingMisses[i]) interleaved.push(upcomingMisses[i]);
    }
    prefillNextEpisodes(interleaved);

    return (
        <section className="relative space-y-6 md:space-y-10">
            {/* Ambient glow anchored to the page, not a box */}
            <div className={`absolute -top-24 w-120 h-120 rounded-full blur-[160px] -z-10 pointer-events-none hidden md:block ${cfg.glow}`} />

            <HomeSectionHeader eyebrow={cfg.eyebrow} title={cfg.title} subtitle={cfg.subtitle} accent={cfg.accent} />

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
                    nextEpisodes={nextEpisodes}
                    datesArePremieres
                />
            </div>
        </section>
    );
}
