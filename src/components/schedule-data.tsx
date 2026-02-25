import { getScheduleEntries } from "@/actions/schedule";
import { ScheduleCalendar } from "@/components/schedule-calendar";

export async function ScheduleData({ initialDate }: { initialDate?: string }) {
    const entries = await getScheduleEntries();
    return <ScheduleCalendar entries={entries} initialDate={initialDate} />;
}
