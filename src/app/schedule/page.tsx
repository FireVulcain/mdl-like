import { ScheduleData } from "@/components/schedule-data";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function ScheduleSkeleton() {
    return (
        <div className="min-h-screen bg-linear-to-b ">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
                {/* Page header skeleton */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
                            <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Schedule</h1>
                            <div className="h-4 w-48 mt-1 rounded bg-white/10 animate-pulse" />
                        </div>
                    </div>
                    <div className="h-9 w-56 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
                </div>

                {/* Calendar grid skeleton */}
                <div className="rounded-2xl border border-white/10 overflow-hidden animate-pulse">
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
