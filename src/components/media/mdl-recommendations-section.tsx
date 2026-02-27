import { prisma } from "@/lib/prisma";
import { kuryanaGetRecommendations } from "@/lib/kuryana";
import { RecommendationsWithToggle } from "./recommendations-with-toggle";
import { getMdlRatingsForTmdbIds } from "@/actions/person";
import type { UnifiedMedia } from "@/services/media.service";

interface Props {
    tmdbRecs: UnifiedMedia[];
    externalId: string;
    season: number;
    watchlistIds: string[];
}

export async function MdlRecommendationsSection({ tmdbRecs, externalId, season, watchlistIds }: Props) {
    // Resolve the effective MDL slug (season-aware, same logic as episode guide)
    const cached = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId: externalId },
        select: { mdlSlug: true },
    });

    let effectiveSlug: string | null = null;
    if (cached?.mdlSlug) {
        if (season === 1) {
            effectiveSlug = cached.mdlSlug;
        } else {
            const seasonLink = await prisma.mdlSeasonLink.findUnique({
                where: { tmdbExternalId_season: { tmdbExternalId: externalId, season } },
            });
            effectiveSlug = seasonLink?.mdlSlug ?? null;
        }
    }

    let mdlRecs = null;
    if (effectiveSlug) {
        const result = await kuryanaGetRecommendations(effectiveSlug);
        mdlRecs = result?.data?.recommendations ?? null;
    }

    // Batch-check which MDL rec slugs are already linked to a TMDB entry + get ratings
    const linkedMap: Record<string, string> = {};
    const mdlSlugToRatingMap: Record<string, number> = {};

    if (mdlRecs && mdlRecs.length > 0) {
        const slugs = mdlRecs.map((r) => r.url.replace(/^\//, ""));
        const linked = await prisma.cachedMdlData.findMany({
            where: { mdlSlug: { in: slugs } },
            select: { mdlSlug: true, tmdbExternalId: true, mdlRating: true },
        });
        for (const row of linked) {
            linkedMap[row.mdlSlug] = row.tmdbExternalId;
            if (row.mdlRating != null) mdlSlugToRatingMap[row.mdlSlug] = row.mdlRating;
        }
    }

    // Pre-fetch MDL ratings for the TMDB recs
    const tmdbIds = tmdbRecs.filter((m) => m.id.startsWith("tmdb-")).map((m) => m.externalId);
    const tmdbMdlRatingsMap = await getMdlRatingsForTmdbIds(tmdbIds);

    if ((!tmdbRecs || tmdbRecs.length === 0) && (!mdlRecs || mdlRecs.length === 0)) {
        return (
            <div>
                <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                <div className="text-center py-12 text-gray-400">No recommendations available.</div>
            </div>
        );
    }

    return (
        <RecommendationsWithToggle
            tmdbRecs={tmdbRecs}
            mdlRecs={mdlRecs}
            watchlistIds={watchlistIds}
            linkedMap={linkedMap}
            tmdbRatingsMap={tmdbMdlRatingsMap}
            mdlSlugToRatingMap={mdlSlugToRatingMap}
        />
    );
}
