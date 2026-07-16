import { getScheduleEntries } from "@/actions/schedule";
import { getCalendarPreferences, getDisplayPreferences } from "@/actions/preferences";
import { getNativeTitlesAndBackfill } from "@/lib/native-titles";
import { prisma } from "@/lib/prisma";
import { ScheduleCalendar } from "@/components/schedule-calendar";

export async function ScheduleData({ initialDate }: { initialDate?: string }) {
    const [entries, prefs, displayPrefs] = await Promise.all([
        getScheduleEntries(),
        getCalendarPreferences(),
        getDisplayPreferences(),
    ]);

    // Spoiler-free mode: episode numbers and dates only, no episode names
    let safeEntries = displayPrefs.hideSpoilers ? entries.map((e) => ({ ...e, episodeName: undefined })) : entries;

    // Display-only native titles: calendar entries carry "tmdb-<id>" mediaIds,
    // resolve them to MDL slugs then to the cached native titles
    if (displayPrefs.titleLanguage === "native" && safeEntries.length > 0) {
        const tmdbIds = [...new Set(safeEntries.map((e) => e.mediaId.replace(/^tmdb-/, "")))];
        const linked = await prisma.cachedMdlData.findMany({
            where: { tmdbExternalId: { in: tmdbIds }, mdlDisabled: false, mdlSlug: { not: "" } },
            select: { tmdbExternalId: true, mdlSlug: true },
        });
        const slugByTmdbId = new Map(linked.map((r) => [r.tmdbExternalId, r.mdlSlug]));
        const titles = await getNativeTitlesAndBackfill([...slugByTmdbId.values()]);
        safeEntries = safeEntries.map((e) => {
            const slug = slugByTmdbId.get(e.mediaId.replace(/^tmdb-/, ""));
            const native = slug ? titles.get(slug) : undefined;
            return native ? { ...e, title: native } : e;
        });
    }

    return <ScheduleCalendar entries={safeEntries} initialDate={initialDate} initialPrefs={prefs} />;
}
