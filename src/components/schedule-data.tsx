import { getScheduleEntries } from "@/actions/schedule";
import { ScheduleCalendar } from "@/components/schedule-calendar";

const MOCK_USER_ID = "mock-user-1";

export async function ScheduleData({ initialDate }: { initialDate?: string }) {
    const entries = await getScheduleEntries(MOCK_USER_ID);
    return <ScheduleCalendar entries={entries} initialDate={initialDate} />;
}
