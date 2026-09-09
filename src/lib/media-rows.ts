import { prisma } from "@/lib/prisma";
import { getWatchlistPosters } from "@/actions/user-media";
import type { UnifiedMedia } from "@/services/media.service";

/**
 * Two things a listing cannot know on its own, both answered from what the DB
 * already holds — no scrape, no TMDB call, one indexed query each:
 *
 *   - the poster the reader picked by hand, which outranks whatever the source
 *     returned. /media and a person's filmography already apply that rule; a
 *     search that answers with TMDB's cover is showing them the one they went
 *     out of their way to replace.
 *   - the MDL score for a TMDB row, where we have cached the link. It stays
 *     absent on titles we have never looked up rather than being fetched on
 *     sight — a search page would turn one query into twenty scrapes.
 *
 * Both passes are no-ops for a reader with an empty watchlist and a cold cache.
 */
export async function enrichMediaRows(media: UnifiedMedia[]): Promise<UnifiedMedia[]> {
    if (media.length === 0) return media;

    const tmdbIds = media.filter((m) => m.id.startsWith("tmdb-")).map((m) => m.id.slice(5));
    const slugs = media.filter((m) => m.id.startsWith("mdl-")).map((m) => m.id.slice(4));

    const [picked, mdlRatings] = await Promise.all([readPickedPosters(), readMdlRatings(tmdbIds)]);

    const posterFor = await buildPosterLookup(picked, slugs);

    return media.map((row) => {
        const link = row.id.startsWith("mdl-")
            ? posterFor.linkedBySlug.get(row.id.slice(4))
            : row.id.startsWith("tmdb-")
              ? { tmdbExternalId: row.id.slice(5), season: undefined }
              : null;

        const poster = link ? posterFor.pick(link.tmdbExternalId, link.season) : null;
        // An MDL row already carries MDL's own score in `rating`; a second copy
        // beside it would say the same thing twice.
        const mdlRating = row.source === "MDL" ? undefined : mdlRatings.get(row.id.slice(5));

        if (!poster && mdlRating === undefined) return row;
        return { ...row, ...(poster ? { poster } : {}), ...(mdlRating !== undefined ? { mdlRating } : {}) };
    });
}

async function readPickedPosters() {
    try {
        return await getWatchlistPosters();
    } catch {
        // Signed out, or the row could not be read — the listing's own posters stand.
        return [];
    }
}

async function readMdlRatings(tmdbIds: string[]): Promise<Map<string, number>> {
    if (tmdbIds.length === 0) return new Map();
    try {
        const rows = await prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: tmdbIds }, mdlRating: { not: null } },
            select: { tmdbExternalId: true, mdlRating: true },
        });
        return new Map(rows.map((r) => [r.tmdbExternalId, r.mdlRating!]));
    } catch {
        return new Map();
    }
}

type PickedPoster = { externalId: string; season: number; poster: string | null };

async function buildPosterLookup(picked: PickedPoster[], slugs: string[]) {
    const linkedBySlug = new Map<string, { tmdbExternalId: string; season?: number }>();
    if (picked.length === 0) return { linkedBySlug, pick: () => null as string | null };

    // Keyed by season first, since a show tracked as several seasons carries one
    // poster per row, then by show for the listings that name no season — which
    // is all of them here: a search result is a show, not a season of one.
    const bySeason = new Map(picked.map((p) => [`${p.externalId}-${p.season}`, p.poster]));
    const byShow = new Map<string, string>();
    for (const p of picked) if (p.poster && !byShow.has(p.externalId)) byShow.set(p.externalId, p.poster);

    // MDL rows name a slug, not a TMDB id, so they need the link tables to know
    // whether the reader has an opinion about this show at all. Narrowed to the
    // ids that carry a picked poster — without that this reads every link row
    // for every result, to answer "no" about nearly all of them.
    if (slugs.length > 0) {
        const pickedIds = [...new Set(picked.map((p) => p.externalId))];
        try {
            const [linkRows, seasonRows, aliasRows] = await Promise.all([
                prisma.cachedMdlData.findMany({
                    where: { mdlSlug: { in: slugs }, tmdbExternalId: { in: pickedIds } },
                    select: { mdlSlug: true, tmdbExternalId: true },
                }),
                prisma.mdlSeasonLink.findMany({
                    where: { mdlSlug: { in: slugs }, tmdbExternalId: { in: pickedIds } },
                    select: { mdlSlug: true, tmdbExternalId: true, season: true },
                }),
                prisma.mdlAlias.findMany({
                    where: { mdlSlug: { in: slugs }, tmdbExternalId: { in: pickedIds } },
                    select: { mdlSlug: true, tmdbExternalId: true },
                }),
            ]);
            for (const r of linkRows) linkedBySlug.set(r.mdlSlug, { tmdbExternalId: r.tmdbExternalId });
            for (const r of aliasRows) linkedBySlug.set(r.mdlSlug, { tmdbExternalId: r.tmdbExternalId });
            // Season links last: the most specific answer wins the key.
            for (const r of seasonRows) linkedBySlug.set(r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season });
        } catch {
            // No links resolved — MDL rows keep MDL's artwork.
        }
    }

    const pick = (tmdbExternalId: string, season?: number): string | null =>
        (season != null ? bySeason.get(`${tmdbExternalId}-${season}`) : null) ??
        bySeason.get(`${tmdbExternalId}-1`) ??
        byShow.get(tmdbExternalId) ??
        null;

    return { linkedBySlug, pick };
}
