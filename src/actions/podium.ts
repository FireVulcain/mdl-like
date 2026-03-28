"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

export type PodiumCategory = "general" | "kdrama" | "cdrama";

export type PodiumEntry = {
    rank: number;
    externalId: string;
    source: string;
    mediaType: string;
    title: string;
    poster: string | null;
    year: number | null;
};

export type PodiumDraft = Omit<PodiumEntry, "rank"> | null;

export async function getPublicPodiums(userId: string): Promise<Record<PodiumCategory, PodiumEntry[]>> {
    const rows = await prisma.profilePodium.findMany({
        where: { userId },
        orderBy: { rank: "asc" },
        select: {
            rank: true,
            category: true,
            externalId: true,
            source: true,
            mediaType: true,
            title: true,
            poster: true,
            year: true,
        },
    });

    const result: Record<PodiumCategory, PodiumEntry[]> = { general: [], kdrama: [], cdrama: [] };

    for (const row of rows) {
        const cat = row.category as PodiumCategory;
        if (cat in result) {
            result[cat].push({
                rank: row.rank,
                externalId: row.externalId,
                source: row.source,
                mediaType: row.mediaType,
                title: row.title,
                poster: row.poster,
                year: row.year,
            });
        }
    }

    return result;
}

export async function saveAllPodiums(
    profileUserId: string,
    drafts: Record<PodiumCategory, [PodiumDraft, PodiumDraft, PodiumDraft]>
): Promise<void> {
    const currentUserId = await getCurrentUserId();
    if (currentUserId !== profileUserId) throw new Error("Forbidden");

    await prisma.$transaction(async (tx) => {
        for (const [category, entries] of Object.entries(drafts) as [PodiumCategory, [PodiumDraft, PodiumDraft, PodiumDraft]][]) {
            for (let i = 0; i < 3; i++) {
                const rank = i + 1;
                const entry = entries[i];
                if (entry === null) {
                    await tx.profilePodium.deleteMany({
                        where: { userId: profileUserId, category, rank },
                    });
                } else {
                    await tx.profilePodium.upsert({
                        where: { userId_category_rank: { userId: profileUserId, category, rank } },
                        create: { userId: profileUserId, category, rank, ...entry },
                        update: { ...entry },
                    });
                }
            }
        }
    });

    revalidatePath(`/u/${profileUserId}`);
}
