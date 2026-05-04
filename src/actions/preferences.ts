"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

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
