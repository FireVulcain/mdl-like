"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { mediaService } from "@/services/media.service";
import type { KuryanaChineseShow, KuryanaTopCountry } from "@/lib/kuryana";

/**
 * Re-scrapes a universe's top lists (completed/ongoing/upcoming) after the
 * section has already painted from CachedMdlTop, and overwrites that cache
 * row for next time.
 *
 * Same shape as refreshMdlLiveData: the debounce below protects Kuryana from
 * a reload loop, it isn't a freshness window — every genuine visit refreshes.
 */
const DEBOUNCE_MS = 60_000;

type TopLists = { completed: KuryanaChineseShow[]; ongoing: KuryanaChineseShow[]; upcoming: KuryanaChineseShow[] };

// What entered each list, so the caller can say so instead of just saying
// "something did". Keyed by the same labels the section rows already use.
export type UniverseLiveChange = { label: "Top Rated" | "Airing Now" | "Coming Soon"; added: number };
export type UniverseRefreshResult = { refreshed: boolean; changes?: UniverseLiveChange[] };

function newEntries(before: KuryanaChineseShow[] | undefined, after: KuryanaChineseShow[] | undefined): number {
    const beforeIds = new Set((before ?? []).map((s) => s.id));
    return (after ?? []).filter((s) => !beforeIds.has(s.id)).length;
}

export async function refreshUniverseTop(
    country: KuryanaTopCountry,
    isoCountry: string,
    excludeTags?: string,
): Promise<UniverseRefreshResult> {
    try {
        const where = { country_excludeTags: { country, excludeTags: excludeTags ?? "" } };
        const existing = await prisma.cachedMdlTop.findUnique({ where });
        if (existing?.liveRefreshedAt && Date.now() - existing.liveRefreshedAt.getTime() < DEBOUNCE_MS) {
            return { refreshed: false };
        }
        const before = existing?.dataJson as unknown as TopLists | undefined;

        // fresh=true bypasses the cache read and overwrites the row with the
        // live result.
        await mediaService.getDramasByCountry(country, isoCountry, excludeTags, true);

        const after = await prisma.cachedMdlTop.findUnique({ where });
        if (!after) return { refreshed: false };
        await prisma.cachedMdlTop.update({ where, data: { liveRefreshedAt: new Date() } });

        const afterData = after.dataJson as unknown as TopLists;
        const changed = JSON.stringify(before) !== JSON.stringify(afterData);
        if (changed) revalidatePath("/");
        if (!changed) return { refreshed: false };

        const changes: UniverseLiveChange[] = (
            [
                { label: "Top Rated", added: newEntries(before?.completed, afterData.completed) },
                { label: "Airing Now", added: newEntries(before?.ongoing, afterData.ongoing) },
                { label: "Coming Soon", added: newEntries(before?.upcoming, afterData.upcoming) },
            ] as const
        ).filter((c) => c.added > 0);

        return { refreshed: true, changes };
    } catch {
        // A failed scrape must never surface on a page that already rendered fine
        return { refreshed: false };
    }
}
