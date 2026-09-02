"use server";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { DEFAULT_PALETTE_SHORTCUTS, parseChord, serializeChord } from "@/lib/shortcuts";
import { normalizeMdlProfileUrl } from "@/lib/mdl-profile-url";
import { Prisma } from "@prisma/client";
import {
    DEFAULT_EXCLUDED_TAGS,
    DEFAULT_HOME_SECTIONS,
    normalizeHomeSections,
    type ExcludedTag,
    type HomeSectionConfig,
} from "@/lib/home-preferences";

// Every getter below reads the same row, and pages often call several of them in
// one render (the watchlist calls two). cache() collapses those into one query per
// request. Writers still hit the DB directly and revalidate as before.
const getPreferencesRow = cache((userId: string) => prisma.userPreferences.findUnique({ where: { userId } }));

export async function getHomeSections(): Promise<HomeSectionConfig[]> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        if (!prefs?.homeSections) return DEFAULT_HOME_SECTIONS;
        return normalizeHomeSections(prefs.homeSections as HomeSectionConfig[]);
    } catch {
        return DEFAULT_HOME_SECTIONS;
    }
}

export async function saveHomeSections(sections: HomeSectionConfig[]): Promise<void> {
    const userId = await getCurrentUserId();
    const clean = normalizeHomeSections(
        sections.filter((s) => typeof s.id === "string").map((s) => ({ id: s.id, enabled: !!s.enabled })),
    );
    await prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, homeSections: clean as unknown as Prisma.InputJsonValue },
        update: { homeSections: clean as unknown as Prisma.InputJsonValue },
    });
    revalidatePath("/");
}

export type ExcludedTagsPreferences = {
    tags: ExcludedTag[];
    applyToBrowse: boolean;
};

export async function getExcludedTagsPreferences(): Promise<ExcludedTagsPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        // null/undefined tags = never configured → defaults; [] = user cleared everything on purpose
        const tags =
            !prefs || prefs.homeExcludedTags === null || prefs.homeExcludedTags === undefined
                ? DEFAULT_EXCLUDED_TAGS
                : (prefs.homeExcludedTags as ExcludedTag[]);
        return { tags, applyToBrowse: prefs?.applyExcludedTagsToBrowse ?? false };
    } catch {
        return { tags: DEFAULT_EXCLUDED_TAGS, applyToBrowse: false };
    }
}

export async function getHomeExcludedTags(): Promise<ExcludedTag[]> {
    return (await getExcludedTagsPreferences()).tags;
}

export async function saveHomeExcludedTags(tags: ExcludedTag[], applyToBrowse?: boolean): Promise<void> {
    const userId = await getCurrentUserId();
    const clean = tags
        .filter((t) => Number.isFinite(t.id) && typeof t.name === "string")
        .map((t) => ({ id: t.id, name: t.name.slice(0, 100) }));

    const data = {
        homeExcludedTags: clean as unknown as Prisma.InputJsonValue,
        ...(applyToBrowse !== undefined ? { applyExcludedTagsToBrowse: applyToBrowse } : {}),
    };
    await prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
    });
    revalidatePath("/");
    revalidatePath("/dramas");
}

export type DramasView = "grid" | "list";

export type ViewPreferences = {
    watchlistThumbnailStyle: "poster" | "backdrop";
    watchlistDefaultSort: string;
    defaultAddStatus: string;
    dramasView: DramasView;
};

const VIEW_DEFAULTS: ViewPreferences = {
    watchlistThumbnailStyle: "poster",
    watchlistDefaultSort: "default",
    defaultAddStatus: "Watching",
    dramasView: "grid",
};

export async function getViewPreferences(): Promise<ViewPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        if (!prefs) return VIEW_DEFAULTS;
        return {
            watchlistThumbnailStyle: prefs.watchlistThumbnailStyle === "backdrop" ? "backdrop" : "poster",
            watchlistDefaultSort: prefs.watchlistDefaultSort,
            defaultAddStatus: prefs.defaultAddStatus,
            dramasView: prefs.dramasView === "list" ? "list" : "grid",
        };
    } catch {
        return VIEW_DEFAULTS;
    }
}

export async function saveViewPreferences(prefs: Partial<ViewPreferences>): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, ...VIEW_DEFAULTS, ...prefs },
            update: prefs,
        });
        revalidatePath("/watchlist");
    } catch {
        // Silently fail — preference save is non-critical
    }
}

// The /dramas view switch. Its own writer rather than a saveViewPreferences
// call: that one revalidates /watchlist, and this save happens *during* a
// navigation to /dramas that already renders the chosen view — so it must not
// invalidate the page it is being made from.
export async function saveDramasView(view: DramasView): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        const dramasView: DramasView = view === "list" ? "list" : "grid";
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, dramasView },
            update: { dramasView },
        });
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export type ThemePreference = "dark" | "light";

// next-themes still owns the live switch: it writes the class before the first
// paint from localStorage, which no server read can beat. This row is what a
// browser that has never been here falls back to, so the choice follows the
// account rather than the device.
export async function getThemePreference(): Promise<ThemePreference> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        return prefs?.theme === "light" ? "light" : "dark";
    } catch {
        return "dark";
    }
}

export async function saveThemePreference(theme: ThemePreference): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        const value: ThemePreference = theme === "light" ? "light" : "dark";
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, theme: value },
            update: { theme: value },
        });
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export type DisplayPreferences = {
    titleLanguage: "english" | "native";
    hideSpoilers: boolean;
};

const DISPLAY_DEFAULTS: DisplayPreferences = { titleLanguage: "english", hideSpoilers: false };

export async function getDisplayPreferences(): Promise<DisplayPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        if (!prefs) return DISPLAY_DEFAULTS;
        return {
            titleLanguage: prefs.titleLanguage === "native" ? "native" : "english",
            hideSpoilers: prefs.hideSpoilers,
        };
    } catch {
        return DISPLAY_DEFAULTS;
    }
}

export async function saveDisplayPreferences(prefs: Partial<DisplayPreferences>): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, ...DISPLAY_DEFAULTS, ...prefs },
            update: prefs,
        });
        revalidatePath("/");
        revalidatePath("/calendar");
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export type ShortcutPreferences = { commandPaletteShortcuts: string[] };

export async function getShortcutPreferences(): Promise<ShortcutPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        const stored = prefs?.commandPaletteShortcuts;
        // A stored empty array means "no shortcut, I use the header badge" and
        // must survive; only null falls back to the defaults.
        if (!Array.isArray(stored)) return { commandPaletteShortcuts: DEFAULT_PALETTE_SHORTCUTS };
        return { commandPaletteShortcuts: stored.filter((c): c is string => typeof c === "string") };
    } catch {
        return { commandPaletteShortcuts: DEFAULT_PALETTE_SHORTCUTS };
    }
}

export async function saveShortcutPreferences(shortcuts: string[]): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        // Re-serialized server-side so a hand-edited request cannot store a
        // spelling the matcher would never recognise.
        const cleaned = [...new Set(shortcuts.map((raw) => parseChord(raw)).filter((c) => c !== null).map(serializeChord))];
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, commandPaletteShortcuts: cleaned },
            update: { commandPaletteShortcuts: cleaned },
        });
        revalidatePath("/", "layout");
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export type ProfilePreferences = {
    publicProfileEnabled: boolean;
    publicShowScores: boolean;
    publicShowPodium: boolean;
    publicShowActivity: boolean;
};

const PROFILE_DEFAULTS: ProfilePreferences = {
    publicProfileEnabled: true,
    publicShowScores: true,
    publicShowPodium: true,
    publicShowActivity: true,
};

export async function getProfilePreferences(): Promise<ProfilePreferences> {
    try {
        const userId = await getCurrentUserId();
        return getProfileVisibility(userId);
    } catch {
        return PROFILE_DEFAULTS;
    }
}

// Visibility of SOMEONE ELSE's profile — keyed by the profile owner's id, no
// auth required (used by the public /u/<id> page).
export async function getProfileVisibility(userId: string): Promise<ProfilePreferences> {
    try {
        const prefs = await getPreferencesRow(userId);
        if (!prefs) return PROFILE_DEFAULTS;
        return {
            publicProfileEnabled: prefs.publicProfileEnabled,
            publicShowScores: prefs.publicShowScores,
            publicShowPodium: prefs.publicShowPodium,
            publicShowActivity: prefs.publicShowActivity,
        };
    } catch {
        return PROFILE_DEFAULTS;
    }
}

export async function saveProfilePreferences(prefs: Partial<ProfilePreferences>): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, ...PROFILE_DEFAULTS, ...prefs },
            update: prefs,
        });
        revalidatePath(`/u/${userId}`);
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export type NotificationPreferences = {
    showSyncNotification: boolean;
};

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        return { showSyncNotification: prefs?.showSyncNotification ?? true };
    } catch {
        return { showSyncNotification: true };
    }
}

export async function saveNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, showSyncNotification: prefs.showSyncNotification ?? true },
            update: prefs,
        });
        revalidatePath("/", "layout");
    } catch {
        // Silently fail — preference save is non-critical
    }
}

export async function getMdlProfileUrl(): Promise<string | null> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        return prefs?.mdlProfileUrl || null;
    } catch {
        return null;
    }
}

export async function saveMdlProfileUrl(raw: string): Promise<{ ok: boolean; url: string | null; error?: string }> {
    const { url, error } = normalizeMdlProfileUrl(raw);
    if (error) return { ok: false, url: null, error };

    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, mdlProfileUrl: url },
            update: { mdlProfileUrl: url },
        });
        // The header lives in the root layout, so the whole tree needs it
        revalidatePath("/", "layout");
        return { ok: true, url };
    } catch {
        return { ok: false, url: null, error: "Could not save. Try again." };
    }
}

export type CalendarPreferences = {
    calendarAsianOnly: boolean;
    calendarIncludePlanToWatch: boolean;
};

const DEFAULTS: CalendarPreferences = {
    calendarAsianOnly: false,
    calendarIncludePlanToWatch: true,
};

export async function getCalendarPreferences(): Promise<CalendarPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await getPreferencesRow(userId);
        if (!prefs) return DEFAULTS;
        return {
            calendarAsianOnly: prefs.calendarAsianOnly,
            calendarIncludePlanToWatch: prefs.calendarIncludePlanToWatch,
        };
    } catch {
        return DEFAULTS;
    }
}

export async function saveCalendarPreferences(prefs: Partial<CalendarPreferences>): Promise<void> {
    try {
        const userId = await getCurrentUserId();
        await prisma.userPreferences.upsert({
            where: { userId },
            create: { userId, ...DEFAULTS, ...prefs },
            update: prefs,
        });
    } catch {
        // Silently fail — preference save is non-critical
    }
}
