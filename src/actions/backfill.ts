"use server";

import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import { revalidatePath } from "next/cache";

export async function backfillBackdrops(userId: string) {
    if (!userId) throw new Error("Unauthorized");

    const items = await prisma.userMedia.findMany({
        where: {
            userId,
            backdrop: null,
        },
    });

    if (items.length === 0) return { success: true, count: 0 };

    let count = 0;
    for (const item of items) {
        try {
            const mediaId = `${item.source.toLowerCase()}-${item.externalId}`;
            const details = await mediaService.getDetails(mediaId);
            
            if (details) {
                await prisma.userMedia.update({
                    where: { id: item.id },
                    data: {
                        backdrop: details.backdrop || details.poster || null,
                        // Optionally update other metadata if missing
                        title: item.title || details.title,
                        poster: item.poster || details.poster,
                    },
                });
                count++;
            }
            // Small delay to be nice to API
            await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
            console.error(`Failed to backfill backdrop for ${item.title || item.externalId}`, e);
        }
    }

    revalidatePath("/watchlist");
    return { success: true, count };
}
