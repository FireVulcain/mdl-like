"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember } from "@/lib/kuryana";

function normalizeCast(members: KuryanaCastMember[]) {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

export async function updateMdlLink(tmdbExternalId: string, newMdlSlug: string) {
    if (!tmdbExternalId || !newMdlSlug) {
        throw new Error("Missing required fields");
    }

    try {
        // Fetch fresh data for the new slug immediately
        const [details, castResult] = await Promise.all([kuryanaGetDetails(newMdlSlug), kuryanaGetCast(newMdlSlug)]);

        if (!details?.data) {
            return { success: false, error: "Failed to fetch details for the new MDL link." };
        }

        const ranked = details.data.details?.ranked;
        const popularity = details.data.details?.popularity;

        const mdlRating = details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
        const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
        const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
        const tags = details.data.others?.tags ?? [];

        const cast = castResult?.data?.casts
            ? {
                  main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                  support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                  guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
              }
            : null;

        await prisma.cachedMdlData.upsert({
            where: { tmdbExternalId },
            create: {
                tmdbExternalId,
                mdlSlug: newMdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
            },
            update: {
                mdlSlug: newMdlSlug,
                mdlRating,
                mdlRanking,
                mdlPopularity,
                tags,
                castJson: cast as unknown as Prisma.InputJsonValue,
                cachedAt: new Date(),
            },
        });

        // clear Next.js route cache so the page refetches immediately
        revalidatePath(`/media/${tmdbExternalId}`);
        return { success: true };
    } catch (e) {
        console.error("[MDL Link Update Failed]", e);
        return { success: false, error: "Failed to update MDL link in database." };
    }
}
