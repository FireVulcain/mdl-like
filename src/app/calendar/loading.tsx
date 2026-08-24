/**
 * The month grid, drawn the way the page draws it.
 *
 * This file has to exist even though the page carries its own ScheduleSkeleton:
 * that one only appears once the route has committed, and a route with no
 * loading file of its own falls back to the nearest ancestor's — which here is
 * src/app/loading.tsx, the home page's hero and rails. Deleting this file does
 * not mean "no skeleton", it means "the wrong one".
 */
const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function Loading() {
    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container mx-auto py-8 px-4 space-y-6 max-w-6xl">
                {/* Month as the title, the count under it, bare controls right */}
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

                {/* The day names are real text: they are the same seven words
                    whatever month loads, so printing them costs no correction. */}
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
