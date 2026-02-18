import { getScheduleEntries } from "@/actions/schedule";
import { ScheduleCalendar } from "@/components/schedule-calendar";

const MOCK_USER_ID = "mock-user-1";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const [entries, { date }] = await Promise.all([
        getScheduleEntries(MOCK_USER_ID),
        searchParams,
    ]);

    return <ScheduleCalendar entries={entries} initialDate={date} />;
}
