import { prisma } from "@/lib/prisma";
import { kuryanaGetDetails, kuryanaGetCast, KuryanaCastMember } from "@/lib/kuryana";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

function normalizeCast(members: KuryanaCastMember[]) {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

export async function POST(req: Request) {
    const { tmdbExternalId, mediaId } = await req.json();

    if (!tmdbExternalId || typeof tmdbExternalId !== "string") {
        return Response.json({ error: "Missing tmdbExternalId" }, { status: 400 });
    }

    // Look up the existing row to reuse its known MDL slug
    const existing = await prisma.cachedMdlData.findUnique({
        where: { tmdbExternalId },
        select: { mdlSlug: true },
    });

    if (existing?.mdlSlug) {
        // Slug already known — fetch fresh data directly, no title search needed
        try {
            const [details, castResult] = await Promise.all([
                kuryanaGetDetails(existing.mdlSlug),
                kuryanaGetCast(existing.mdlSlug),
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
                          main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
                          support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
                          guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
                      }
                    : undefined;

                await prisma.cachedMdlData.update({
                    where: { tmdbExternalId },
                    data: {
                        mdlRating,
                        mdlRanking,
                        mdlPopularity,
                        tags,
                        ...(cast ? { castJson: cast as unknown as Prisma.InputJsonValue } : {}),
                        cachedAt: new Date(),
                    },
                });
            }
        } catch (e) {
            console.error("[MDL reset] Kuryana fetch failed, falling back to cache clear:", e);
            // Fallback: clear the row so getMdlData re-searches by title on next load
            await prisma.cachedMdlData.deleteMany({ where: { tmdbExternalId } });
        }
    } else {
        // No slug known yet — clear the row so getMdlData re-searches by title on next load
        await prisma.cachedMdlData.deleteMany({ where: { tmdbExternalId } });
    }

    if (mediaId) {
        revalidatePath(`/media/${mediaId}`);
    }

    return Response.json({ ok: true });
}
