import { ScheduleData } from "@/components/schedule-data";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Calendar",
    description: "When the next episode of everything on your list airs.",
};

export const dynamic = "force-dynamic";

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function ScheduleSkeleton() {
    return (
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
                {/* Mirrors the real header: the month as the title, the count under
                    it, bare controls on the right. It has to be redrawn whenever
                    that header changes — this one still showed an icon in a tinted
                    square and the word "Calendar", neither of which exists any
                    more. The title is a shape rather than text: the month is not
                    known until the data arrives, and printing the wrong word only
                    to replace it is worse than printing nothing. */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="animate-pulse">
                        <div className="h-8 w-52 rounded bg-white/10" />
                        <div className="h-4 w-40 mt-2 rounded bg-white/8" />
                    </div>
                    <div className="flex items-center gap-2 animate-pulse">
                        <div className="h-9 w-9 rounded-lg bg-white/5" />
                        <div className="h-5 w-12 rounded bg-white/5" />
                        <div className="h-9 w-20 rounded-lg bg-white/5" />
                    </div>
                </div>

                {/* Calendar grid skeleton */}
                <div className="rounded-lg border border-white/10 overflow-hidden animate-pulse">
                    <div className="grid grid-cols-7 bg-white/4 border-b border-white/10">
                        {DAY_HEADERS.map((day) => (
                            <div key={day} className="py-3 text-center text-xs font-semibold tracking-wider text-gray-400">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {Array.from({ length: 35 }).map((_, i) => (
                            <div
                                key={i}
                                className={["min-h-28 p-2", i < 28 ? "border-b border-white/5" : "", i % 7 !== 6 ? "border-r border-white/5" : ""]
                                    .filter(Boolean)
                                    .join(" ")}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const { date } = await searchParams;

    return (
        <Suspense fallback={<ScheduleSkeleton />}>
            <ScheduleData initialDate={date} />
        </Suspense>
    );
}
