/**
 * The shape of a media page, shown the instant one is asked for.
 *
 * Without a loading file a client-side navigation does not commit until the
 * server has finished the whole route, so clicking a title from the watchlist
 * left the reader on the watchlist for about a second — the progress bar
 * running honestly, because the navigation genuinely had not started. The
 * Suspense boundaries inside the page could not help: they cannot stream
 * before the shell they live in has arrived.
 *
 * This is that shell. It turns the wait into a page that is filling in rather
 * than a page that has not begun, and it is what lets everything behind it
 * stream instead of landing in one piece at the end.
 *
 * Built from the real page's own measurements and pieces — the 25vh backdrop
 * fading through its mask, the 300px sidebar with the status bar docked to the
 * poster and the info box under it, the leads' boxes and the supporting rows —
 * so the layout does not jump when the content replaces it.
 */
import { Line } from "@/components/skeleton-parts";

const pulse = "animate-pulse bg-surface-2";

export default function Loading() {
    return (
        <div className="min-h-screen bg-linear-to-b -mt-24">
            <div className="relative h-[25vh] min-h-44 w-full overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent)]">
                <div className="h-full w-full animate-pulse bg-linear-to-br from-surface-3 to-surface-2" />
            </div>

            <div className="container relative -top-20 z-10 md:grid md:gap-8 md:grid-cols-[300px_1fr] m-auto pb-20 px-4 md:px-6">
                {/* Mobile header: poster beside the title and the status bar */}
                <div className="grid grid-cols-[110px_1fr] gap-3 mb-4 md:hidden">
                    <div className={`aspect-2/3 rounded-lg ${pulse}`} />
                    <div className="flex flex-col gap-2 py-0.5">
                        <Line w="75%" h={18} />
                        <Line w="50%" h={12} />
                        <Line w="65%" h={12} />
                        <div className="mt-auto h-10 w-full rounded-lg bg-box" />
                    </div>
                </div>

                {/* Desktop sidebar: the poster with the status bar docked under it, then the info box */}
                <div className="hidden md:block space-y-4">
                    <div>
                        <div className={`aspect-2/3 w-full rounded-t-lg ${pulse}`} />
                        <div className="h-11 w-full rounded-b-lg bg-box" />
                    </div>
                    <div className="space-y-3.5 rounded-lg bg-box p-4">
                        <div className="grid grid-cols-2 gap-3 border-b border-line-soft pb-3.5">
                            {[0, 1].map((i) => (
                                <div key={i} className="space-y-1.5">
                                    <Line w={70} h={24} />
                                    <Line w={50} h={11} />
                                </div>
                            ))}
                        </div>
                        {["70%", "35%", "45%", "20%"].map((w, i) => (
                            <div key={i} className="grid grid-cols-[76px_1fr] gap-x-3">
                                <Line w={50} h={12} />
                                <Line w={w} h={12} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-8 min-w-0 md:pt-20">
                    <div className="hidden md:block space-y-3">
                        <Line w="55%" h={36} />
                        <Line w="30%" h={16} />
                    </div>

                    {/* Section nav: words over a hairline, as the page has it */}
                    <div className="flex gap-6 border-b border-line pb-3">
                        {[36, 92, 64, 50, 48, 58, 40, 76].map((w, i) => (
                            <Line key={i} w={w} h={14} />
                        ))}
                    </div>

                    {/* Synopsis, then genres and tags */}
                    <div className="space-y-2">
                        {["100%", "97%", "92%", "60%"].map((w) => (
                            <Line key={w} w={w} h={13} />
                        ))}
                    </div>
                    <div className="space-y-3">
                        {["35%", "80%"].map((w, i) => (
                            <div key={i} className="grid grid-cols-[88px_1fr] gap-x-3">
                                <Line w={50} h={13} />
                                <Line w={w} h={13} />
                            </div>
                        ))}
                    </div>

                    {/* Cast: the leads' boxes, then the supporting rows */}
                    <div className="space-y-5">
                        <Line w={90} h={22} />
                        <div className="grid gap-3 sm:grid-cols-2">
                            {[0, 1].map((i) => (
                                <div key={i} className="flex gap-4 rounded-lg bg-box p-3">
                                    <div className={`w-24 sm:w-27 aspect-3/4 shrink-0 rounded-md ${pulse}`} />
                                    <div className="flex flex-1 flex-col justify-end gap-2">
                                        <Line w="60%" h={18} />
                                        <Line w="40%" h={13} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    <div className={`h-12 w-9 shrink-0 rounded ${pulse}`} />
                                    <div className="flex-1 space-y-1.5">
                                        <Line w="70%" h={12} />
                                        <Line w="50%" h={11} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Relationships: one box per lead */}
                    <div className="space-y-4">
                        <Line w={140} h={22} />
                        <div className="grid gap-3 md:grid-cols-2">
                            {[0, 1].map((box) => (
                                <div key={box} className="space-y-3 rounded-lg bg-box p-3.5">
                                    <div className="flex items-center gap-2.5 border-b border-line-soft pb-2.5">
                                        <div className={`h-9 w-9 shrink-0 rounded-full ${pulse}`} />
                                        <Line w={110} h={14} />
                                    </div>
                                    <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
                                        {[0, 1, 2, 3].map((i) => (
                                            <div key={i} className="flex items-center gap-2.5">
                                                <div className={`h-8 w-8 shrink-0 rounded-full ${pulse}`} />
                                                <div className="flex-1 space-y-1.5">
                                                    <Line w="70%" h={12} />
                                                    <Line w="45%" h={11} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
