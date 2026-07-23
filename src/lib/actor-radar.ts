import { prisma } from "@/lib/prisma";
import { kuryanaGetPerson, kuryanaGetDetails, mdlTitleFromLink, type KuryanaWorkItem, type KuryanaPersonResult } from "@/lib/kuryana";
import { buildTasteProfile, type RecMediaItem } from "@/lib/recommendation";
import type { Prisma } from "@prisma/client";

// "New from actors you watch" — crosses the user's actor affinities (from the
// recommendation taste profile) with those actors' MDL filmographies to surface
// recent/upcoming dramas that aren't in the watchlist yet.

export type ActorRadarPerson = { slug: string; name: string; profileImage: string | null; pinned?: boolean };

export type ActorRadarItem = {
    mdlId: string;
    slug: string; // full MDL slug, e.g. "687393-some-title"
    title: string;
    year: number | "TBA";
    mediaType: "TV" | "MOVIE";
    rating: number;
    episodes: number | null;
    poster: string | null;
    tmdbId: string | null; // set when the show is already linked to TMDB in our cache
    season: number | null;
    actors: ActorRadarPerson[]; // which of the user's favorites star in it
};

export type ActorRadarPayload = {
    items: ActorRadarItem[];
    scannedActors: ActorRadarPerson[];
    excludedActors: ActorRadarPerson[];
};

const TOP_ACTOR_COUNT = 8;
const MIN_ACTOR_AFFINITY = 0.2;
// A "favorite actor" must appear in at least this many distinct watched shows —
// the full cast of a single beloved show isn't a list of favorites.
const MIN_DISTINCT_SHOWS = 2;
const MAX_ITEMS = 14;
const PERSON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type CastEntry = { slug?: string; name?: string; profileImage?: string };

function parseCast(raw: Prisma.JsonValue | null): { main: CastEntry[]; support: CastEntry[] } {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { main: [], support: [] };
    const obj = raw as { main?: CastEntry[]; support?: CastEntry[] };
    return { main: obj.main ?? [], support: obj.support ?? [] };
}

function extractMdlId(workSlug: string): string | null {
    const match = workSlug.match(/^mdl-(\d+)$/);
    return match ? match[1] : null;
}

function extractFullMdlSlug(link: string): string | null {
    const match = link.match(/mydramalist\.com\/(.+)$/);
    return match ? match[1] : null;
}

// Person filmography with the same 7-day DB cache the /people page uses
async function getPersonWorks(slug: string): Promise<KuryanaPersonResult["data"] | null> {
    const staleAt = new Date(Date.now() - PERSON_CACHE_TTL_MS);
    const cachedRow = await prisma.cachedKuryanaPerson.findUnique({ where: { slug } });
    if (cachedRow && cachedRow.cachedAt > staleAt) {
        return cachedRow.dataJson as KuryanaPersonResult["data"];
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

export async function computeActorRadar(userId: string): Promise<ActorRadarPayload> {
    const [userMedia, podiums, exclusions, pins] = await Promise.all([
        prisma.userMedia.findMany({ where: { userId } }),
        prisma.profilePodium.findMany({ where: { userId }, select: { externalId: true } }),
        prisma.actorRadarExclusion.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
        prisma.actorRadarPin.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    ]);
    const excludedActors: ActorRadarPerson[] = exclusions.map((e) => ({
        slug: e.personSlug,
        name: e.name,
        profileImage: e.profileImage,
    }));
    const excludedSlugs = new Set(exclusions.map((e) => e.personSlug));
    const pinnedSlugs = new Set(pins.map((p) => p.personSlug));
    const empty: ActorRadarPayload = { items: [], scannedActors: [], excludedActors };

    if (userMedia.length === 0 && pins.length === 0) return empty;

    const externalIds = Array.from(new Set(userMedia.map((m) => m.externalId)));
    const watchlistTmdbIds = new Set(externalIds);
    const podiumIds = new Set(podiums.map((p) => p.externalId));

    const mdlRows = await prisma.cachedMdlData.findMany({
        where: { tmdbExternalId: { in: externalIds } },
        select: { tmdbExternalId: true, castJson: true },
    });
    const mdlByExternalId = new Map(mdlRows.map((r) => [r.tmdbExternalId, r]));

    // Minimal taste-profile input: only the cast facet matters here, but base/quality/
    // recency weighting comes along for free from the shared profile builder.
    const profileImageBySlug = new Map<string, string | null>();
    const items: RecMediaItem[] = userMedia.map((m) => {
        const cast = parseCast(mdlByExternalId.get(m.externalId)?.castJson ?? null);
        for (const member of [...cast.main, ...cast.support]) {
            if (member.slug && !profileImageBySlug.get(member.slug)) {
                profileImageBySlug.set(member.slug, member.profileImage || null);
            }
        }
        return {
            id: m.id,
            externalId: m.externalId,
            source: m.source,
            season: m.season,
            title: m.title,
            poster: m.poster,
            year: m.year,
            originCountry: m.originCountry,
            mediaType: m.mediaType,
            status: m.status,
            score: m.score,
            progress: m.progress,
            totalEp: m.totalEp,
            tmdbRating: m.tmdbRating,
            airingStatus: m.airingStatus,
            lastWatchedAt: m.lastWatchedAt,
            updatedAt: m.updatedAt,
            genres: [],
            tags: [],
            mainCast: cast.main.filter((c) => c.slug).map((c) => ({ slug: c.slug!, name: c.name ?? c.slug! })),
            supportCast: cast.support.filter((c) => c.slug).map((c) => ({ slug: c.slug!, name: c.name ?? c.slug! })),
            directors: [],
            screenwriters: [],
            mdlRating: null,
            mdlPopularity: null,
            isPodium: podiumIds.has(m.externalId),
            addedAt: null,
        };
    });

    const profile = buildTasteProfile(items);

    // Count distinct WATCHED shows per actor (main cast only) for the favorites gate
    const watchedExternalIds = new Set(
        userMedia.filter((m) => ["Completed", "Watching"].includes(m.status)).map((m) => m.externalId),
    );
    const showCountBySlug = new Map<string, number>();
    for (const row of mdlRows) {
        if (!watchedExternalIds.has(row.tmdbExternalId)) continue;
        const cast = parseCast(row.castJson);
        for (const member of cast.main) {
            if (member.slug) showCountBySlug.set(member.slug, (showCountBySlug.get(member.slug) ?? 0) + 1);
        }
    }

    // Pinned actors are always scanned (highest priority, no gates); computed
    // favorites fill the remaining slots.
    const pinnedActors = pins.map((p) => {
        const pathSlug = `/people/${p.personSlug}`;
        return {
            slug: p.personSlug,
            weight: Math.max(profile.cast.get(pathSlug) ?? 0, 0.7),
            name: p.name,
            profileImage: p.profileImage,
            pinned: true,
        };
    });

    const autoActors = Array.from(profile.cast.entries())
        .map(([slug, weight]) => ({
            // castJson stores slugs as "/people/2796-name" paths; kuryana's person
            // endpoint and the CachedKuryanaPerson cache use the bare slug
            bareSlug: slug.replace(/^\/?people\//, ""),
            slug,
            weight,
        }))
        .filter(
            ({ slug, bareSlug, weight }) =>
                weight >= MIN_ACTOR_AFFINITY &&
                (showCountBySlug.get(slug) ?? 0) >= MIN_DISTINCT_SHOWS &&
                !excludedSlugs.has(bareSlug) && // user removed them from the radar
                !pinnedSlugs.has(bareSlug), // already covered by a pin
        )
        .sort((a, b) => b.weight - a.weight)
        .slice(0, Math.max(0, TOP_ACTOR_COUNT - pinnedActors.length))
        .map(({ slug, bareSlug, weight }) => ({
            slug: bareSlug,
            weight,
            name: profile.castNames.get(slug) ?? slug,
            profileImage: profileImageBySlug.get(slug) ?? null,
            pinned: false,
        }));

    const topActors = [...pinnedActors, ...autoActors];
    if (topActors.length === 0) return empty;

    // Fetch filmographies in parallel (7-day cached in DB)
    const personResults = await Promise.allSettled(topActors.map((a) => getPersonWorks(a.slug)));

    const currentYear = new Date().getFullYear();
    type PoolEntry = {
        work: KuryanaWorkItem;
        mdlId: string;
        slug: string;
        mediaType: "TV" | "MOVIE";
        actors: (typeof topActors)[number][];
        maxAffinity: number;
    };
    const pool = new Map<string, PoolEntry>();

    topActors.forEach((actor, idx) => {
        const result = personResults[idx];
        if (result.status !== "fulfilled" || !result.value) return;
        const works = result.value.works;
        // Drama + Movie only — MDL's "TV Show" category is variety/reality content
        const candidates: { list: KuryanaWorkItem[]; mediaType: "TV" | "MOVIE" }[] = [
            { list: works.Drama ?? [], mediaType: "TV" },
            { list: works.Movie ?? [], mediaType: "MOVIE" },
        ];
        for (const { list, mediaType } of candidates) {
            for (const work of list) {
                const isRecent = work.year === "TBA" || (typeof work.year === "number" && work.year >= currentYear - 1);
                if (!isRecent) continue;
                // Only lead roles — a favorite actor in a support part isn't a reason to watch
                if (work.role?.type !== "Main Role") continue;
                const mdlId = extractMdlId(work._slug);
                const slug = extractFullMdlSlug(work.title.link);
                if (!mdlId || !slug) continue;

                const existing = pool.get(mdlId);
                if (existing) {
                    if (!existing.actors.some((a) => a.slug === actor.slug)) existing.actors.push(actor);
                    existing.maxAffinity = Math.max(existing.maxAffinity, actor.weight);
                } else {
                    pool.set(mdlId, { work, mdlId, slug, mediaType, actors: [actor], maxAffinity: actor.weight });
                }
            }
        }
    });
    if (pool.size === 0) return empty;

    // Map pool MDL ids to TMDB links, and drop anything already in the watchlist
    const poolIds = Array.from(pool.keys());
    const [cachedLinks, seasonLinks, aliasLinks] = await Promise.all([
        prisma.cachedMdlData.findMany({
            where: { OR: poolIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
        prisma.mdlSeasonLink.findMany({
            where: { OR: poolIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
            select: { mdlSlug: true, tmdbExternalId: true, season: true },
        }),
        prisma.mdlAlias.findMany({
            where: { OR: poolIds.map((id) => ({ mdlSlug: { startsWith: `${id}-` } })) },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
    ]);
    const tmdbByMdlId = new Map<string, { tmdbId: string; season: number | null }>();
    for (const row of cachedLinks) tmdbByMdlId.set(row.mdlSlug.split("-")[0], { tmdbId: row.tmdbExternalId, season: null });
    for (const row of seasonLinks) {
        const id = row.mdlSlug.split("-")[0];
        if (!tmdbByMdlId.has(id)) tmdbByMdlId.set(id, { tmdbId: row.tmdbExternalId, season: row.season });
    }
    for (const row of aliasLinks) {
        const id = row.mdlSlug.split("-")[0];
        if (!tmdbByMdlId.has(id)) tmdbByMdlId.set(id, { tmdbId: row.tmdbExternalId, season: null });
    }

    const fresh = Array.from(pool.values()).filter((entry) => {
        const link = tmdbByMdlId.get(entry.mdlId);
        return !(link && watchlistTmdbIds.has(link.tmdbId));
    });

    // Watchable-first ordering: released (newest year first), then dated upcoming,
    // then TBA; affinity breaks ties within each tier.
    const tier = (y: number | string) => (y === "TBA" ? 2 : (y as number) > currentYear ? 1 : 0);
    fresh.sort((a, b) => {
        const tierDiff = tier(a.work.year) - tier(b.work.year);
        if (tierDiff !== 0) return tierDiff;
        if (typeof a.work.year === "number" && typeof b.work.year === "number" && a.work.year !== b.work.year) {
            return tier(a.work.year) === 0 ? b.work.year - a.work.year : a.work.year - b.work.year;
        }
        return b.maxAffinity - a.maxAffinity;
    });

    // Cap items per actor so one prolific veteran can't flood the row
    const MAX_PER_ACTOR = 3;
    const perActorCount = new Map<string, number>();
    const top: PoolEntry[] = [];
    for (const entry of fresh) {
        if (top.length >= MAX_ITEMS) break;
        const primary = entry.actors.reduce((best, a) => (a.weight > best.weight ? a : best), entry.actors[0]);
        const used = perActorCount.get(primary.slug) ?? 0;
        if (used >= MAX_PER_ACTOR) continue;
        perActorCount.set(primary.slug, used + 1);
        top.push(entry);
    }

    // Posters + real titles via kuryana details (parallel, Next-cached; only for the
    // final few). Person filmographies return an empty title.name, so the details
    // title is the real source; humanized slug is the fallback.
    const posterResults = await Promise.allSettled(top.map((e) => kuryanaGetDetails(e.slug)));

    const radarItems: ActorRadarItem[] = top.map((entry, idx) => {
        const details = posterResults[idx];
        const detailsData = details.status === "fulfilled" ? details.value?.data : null;
        const poster = detailsData?.poster ?? null;
        const link = tmdbByMdlId.get(entry.mdlId) ?? null;
        return {
            mdlId: entry.mdlId,
            slug: entry.slug,
            title: (entry.work.title.name || detailsData?.title || mdlTitleFromLink(entry.work.title.link)).replace(/\s*\(\d{4}\)\s*$/, ""),
            year: typeof entry.work.year === "number" ? entry.work.year : "TBA",
            mediaType: entry.mediaType,
            rating: entry.work.rating ?? 0,
            episodes: entry.work.episodes ?? null,
            poster,
            tmdbId: link?.tmdbId ?? null,
            season: link?.season ?? null,
            actors: entry.actors.map((a) => ({ slug: a.slug, name: a.name, profileImage: a.profileImage })),
        };
    });

    return {
        items: radarItems,
        scannedActors: topActors.map((a) => ({ slug: a.slug, name: a.name, profileImage: a.profileImage, pinned: a.pinned })),
        excludedActors,
    };
}

