import { prisma } from "@/lib/prisma";
import { kuryanaGetRecommendations } from "@/lib/kuryana";
import { RecommendationsWithToggle } from "./recommendations-with-toggle";
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

    return (
        <RecommendationsWithToggle
            tmdbRecs={tmdbRecs}
            mdlRecs={mdlRecs}
            watchlistIds={watchlistIds}
        />
    );
}
