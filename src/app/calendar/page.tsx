import { ScheduleData } from "@/components/schedule-data";
import { ScheduleSkeleton } from "@/components/schedule-skeleton";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Calendar",
    description: "When the next episode of everything on your list airs.",
};

export const dynamic = "force-dynamic";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string; show?: string }> }) {
    const { date, show } = await searchParams;

    return (
        // `show` is part of the key so following the link from a second show's
        // page rebuilds the schedule rather than reusing the first one's state —
        // the filter is seeded from this prop.
        <Suspense key={show ?? "all"} fallback={<ScheduleSkeleton />}>
            <ScheduleData initialDate={date} initialShow={show} />
        </Suspense>
    );
}
