"use server";

import { prisma } from "@/lib/prisma";
import { kuryanaSearch, KuryanaDrama } from "@/lib/kuryana";
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

    await prisma.mdlSeasonLink.upsert({
        where: { tmdbExternalId_season: { tmdbExternalId, season } },
        create: { tmdbExternalId, season, mdlSlug },
        update: { mdlSlug },
    });

    revalidatePath(`/media/${mediaId}`);
}
