"use server";

import { prisma } from "@/lib/prisma";
import { kuryanaSearch, kuryanaGetDetails, kuryanaGetCast, KuryanaDrama } from "@/lib/kuryana";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function searchMdlDramas(query: string): Promise<KuryanaDrama[]> {
    const result = await kuryanaSearch(query);
    return result?.results?.dramas ?? [];
}

export async function setMdlSeasonSlug(
    tmdbExternalId: string,
    season: number,
    mdlSlug: string,
    mediaId: string,
) {
    if (!mdlSlug) throw new Error("Invalid MDL slug");

    // Upsert the slug immediately so the page can update
    await prisma.mdlSeasonLink.upsert({
        where: { tmdbExternalId_season: { tmdbExternalId, season } },
        create: { tmdbExternalId, season, mdlSlug },
        update: { mdlSlug },
    });

    // Fetch details + cast from Kuryana and cache them in the same row
    try {
        const [details, castResult] = await Promise.all([
            kuryanaGetDetails(mdlSlug),
            kuryanaGetCast(mdlSlug),
        ]);

        if (details?.data) {
            const ranked = details.data.details?.ranked;
            const popularity = details.data.details?.popularity;
            const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
            const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
            const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
            const tags = details.data.others?.tags ?? [];

            const cast = castResult?.data?.casts
                ? {
                      main: (castResult.data.casts["Main Role"] ?? []).map((m) => ({
                          name: m.name, profileImage: m.profile_image ?? "", slug: m.slug,
                          characterName: m.role?.name ?? "", roleType: m.role?.type ?? "Support Role",
                      })),
                      support: (castResult.data.casts["Support Role"] ?? []).map((m) => ({
                          name: m.name, profileImage: m.profile_image ?? "", slug: m.slug,
                          characterName: m.role?.name ?? "", roleType: m.role?.type ?? "Support Role",
                      })),
                      guest: (castResult.data.casts["Guest Role"] ?? []).map((m) => ({
                          name: m.name, profileImage: m.profile_image ?? "", slug: m.slug,
                          characterName: m.role?.name ?? "", roleType: m.role?.type ?? "Support Role",
                      })),
                  }
                : null;

            await prisma.mdlSeasonLink.update({
                where: { tmdbExternalId_season: { tmdbExternalId, season } },
                data: {
                    mdlRating,
                    mdlRanking,
                    mdlPopularity,
                    tags: tags as unknown as Prisma.InputJsonValue,
                    castJson: cast as unknown as Prisma.InputJsonValue,
                    cachedAt: new Date(),
                },
            });
        }
    } catch {
        // Best-effort — slug is saved, data will show on next refetch
    }

    revalidatePath(`/media/${mediaId}`);
}
