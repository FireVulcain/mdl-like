"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";

type ImportItem = {
    title?: string | null;
    type?: string;
    status?: string;
    season?: number;
    progress?: number;
    totalEpisodes?: number | null;
    score?: number | null;
    mdlRating?: number | null;
    country?: string | null;
    year?: number | null;
    genres?: string | null;
    notes?: string | null;
    airingStatus?: string | null;
    source: string;
    externalId: string;
};

const VALID_STATUSES = new Set(["Watching", "Completed", "Plan to Watch", "On Hold", "Dropped"]);

export async function importWatchlist(rawItems: unknown[]): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
}> {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { imported: 0, skipped: 0, errors: ["File contains no items."] };
    }

    const userId = await getCurrentUserId();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const raw of rawItems) {
        const item = raw as ImportItem;

        if (!item.source || !item.externalId) {
            errors.push(`Skipped item missing source/externalId: ${JSON.stringify(item).slice(0, 80)}`);
            skipped++;
            continue;
        }

        const mediaType = item.type ?? "TV";
        const season = item.season ?? 1;
        const status = VALID_STATUSES.has(item.status ?? "") ? (item.status as string) : "Plan to Watch";

        try {
            const existing = await prisma.userMedia.findFirst({
                where: { userId, externalId: item.externalId, source: item.source, season },
            });

            if (existing) {
                skipped++;
                continue;
            }

            await prisma.userMedia.create({
                data: {
                    userId,
                    externalId: item.externalId,
                    source: item.source,
                    mediaType,
                    status,
                    season,
                    progress: item.progress ?? 0,
                    totalEp: item.totalEpisodes ?? null,
                    score: item.score ?? null,
                    mdlRating: item.mdlRating ?? null,
                    title: item.title ?? null,
                    year: item.year ?? null,
                    originCountry: item.country ?? null,
                    genres: item.genres ?? null,
                    notes: item.notes ?? null,
                    airingStatus: item.airingStatus ?? null,
                },
            });
            imported++;
        } catch (e) {
            errors.push(`"${item.title ?? item.externalId}": ${e instanceof Error ? e.message : String(e)}`);
            skipped++;
        }
    }

    if (imported > 0) {
        revalidatePath("/watchlist");
    }

    return { imported, skipped, errors };
}
