"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { DEFAULT_EXCLUDED_TAGS, type ExcludedTag } from "@/lib/home-preferences";

export async function getHomeExcludedTags(): Promise<ExcludedTag[]> {
    try {
        const userId = await getCurrentUserId();
        const prefs = await prisma.userPreferences.findUnique({ where: { userId } });
        // null/undefined = never configured → defaults; [] = user cleared everything on purpose
        if (!prefs || prefs.homeExcludedTags === null || prefs.homeExcludedTags === undefined) {
            return DEFAULT_EXCLUDED_TAGS;
        }
        return prefs.homeExcludedTags as ExcludedTag[];
    } catch {
        return DEFAULT_EXCLUDED_TAGS;
    }
}

export async function saveHomeExcludedTags(tags: ExcludedTag[]): Promise<void> {
    const userId = await getCurrentUserId();
    const clean = tags
        .filter((t) => Number.isFinite(t.id) && typeof t.name === "string")
        .map((t) => ({ id: t.id, name: t.name.slice(0, 100) }));

    await prisma.userPreferences.upsert({
        where: { userId },
        create: { userId, homeExcludedTags: clean as unknown as Prisma.InputJsonValue },
        update: { homeExcludedTags: clean as unknown as Prisma.InputJsonValue },
    });
    revalidatePath("/");
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
