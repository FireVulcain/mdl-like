import { ScheduleData } from "@/components/schedule-data";
import { ScheduleSkeleton } from "@/components/schedule-skeleton";
import { Suspense } from "react";
import type { CalendarLayout } from "@/components/schedule-views";

// Checked here rather than against the list in schedule-views: that module is a
// client one, and a server component only sees references to its exports.
const LAYOUTS: CalendarLayout[] = ["timeline", "cards", "guide", "ready", "rails"];
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Calendar",
    description: "When the next episode of everything on your list airs.",
};

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; show?: string; layout?: string }> }) {
    const { date, show, layout } = await searchParams;
    const initialLayout = LAYOUTS.find((l) => l === layout) ?? "timeline";

    return (
        // `show` is part of the key so following the link from a second show's
        // page rebuilds the calendar rather than reusing the first one's state —
        // the filter and the month it opens on are both seeded from this prop.
        <Suspense key={show ?? "all"} fallback={<ScheduleSkeleton />}>
            <ScheduleData initialDate={date} initialShow={show} initialLayout={initialLayout} />
        </Suspense>
    );
}
