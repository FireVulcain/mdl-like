import { getScheduleEntries } from "@/actions/schedule";
import { getCalendarPreferences } from "@/actions/preferences";
import { ScheduleCalendar } from "@/components/schedule-calendar";

export async function ScheduleData({ initialDate }: { initialDate?: string }) {
    const [entries, prefs] = await Promise.all([getScheduleEntries(), getCalendarPreferences()]);
    return <ScheduleCalendar entries={entries} initialDate={initialDate} initialPrefs={prefs} />;
}
