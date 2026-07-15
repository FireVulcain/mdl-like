"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEFAULT_EXCLUDED_TAGS, type ExcludedTag } from "@/lib/home-preferences";

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
