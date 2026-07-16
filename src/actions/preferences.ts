"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
    DEFAULT_EXCLUDED_TAGS,
    DEFAULT_HOME_SECTIONS,
    normalizeHomeSections,
    type ExcludedTag,
    type HomeSectionConfig,
} from "@/lib/home-preferences";

export async function getHomeSections(): Promise<HomeSectionConfig[]> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
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
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
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

export type ViewPreferences = {
    watchlistThumbnailStyle: "poster" | "backdrop";
    watchlistDefaultSort: string;
    defaultAddStatus: string;
};

const VIEW_DEFAULTS: ViewPreferences = {
    watchlistThumbnailStyle: "poster",
    watchlistDefaultSort: "default",
    defaultAddStatus: "Watching",
};

export async function getViewPreferences(): Promise<ViewPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
        if (!prefs) return VIEW_DEFAULTS;
        return {
            watchlistThumbnailStyle: prefs.watchlistThumbnailStyle === "backdrop" ? "backdrop" : "poster",
            watchlistDefaultSort: prefs.watchlistDefaultSort,
            defaultAddStatus: prefs.defaultAddStatus,
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

export type DisplayPreferences = {
    titleLanguage: "english" | "native";
    hideSpoilers: boolean;
};

const DISPLAY_DEFAULTS: DisplayPreferences = { titleLanguage: "english", hideSpoilers: false };

export async function getDisplayPreferences(): Promise<DisplayPreferences> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
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

export type ProfilePreferences = {
    publicProfileEnabled: boolean;
    publicShowScores: boolean;
};

const PROFILE_DEFAULTS: ProfilePreferences = { publicProfileEnabled: true, publicShowScores: true };

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
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
        if (!prefs) return PROFILE_DEFAULTS;
        return { publicProfileEnabled: prefs.publicProfileEnabled, publicShowScores: prefs.publicShowScores };
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
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
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
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
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
