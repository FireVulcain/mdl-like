import { getHomeExcludedTags, getCalendarPreferences } from "@/actions/preferences";
import { getActorRadar } from "@/actions/actor-radar";
import { HomeExcludedTagsSetting } from "@/components/settings/home-excluded-tags";
import { CalendarSettings } from "@/components/settings/calendar-settings";
import { ActorRadarManagePanel } from "@/components/actor-radar-manage";
import { CalendarDays, House, UsersRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const [excludedTags, calendarPrefs] = await Promise.all([getHomeExcludedTags(), getCalendarPreferences()]);

    let radar: Awaited<ReturnType<typeof getActorRadar>> | null = null;
    try {
        radar = await getActorRadar();
    } catch {
        // Logged out or radar unavailable — the section just doesn't render
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-[#0a0a0f]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(30,41,59,0.4)_0%,transparent_50%)]" />
                <div className="absolute -top-40 -left-40 w-125 h-125 bg-blue-600/15 rounded-full blur-[180px]" />
            </div>

            <div className="container py-8 px-4 mx-auto max-w-3xl relative z-10">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
                    <p className="text-gray-500 mt-1">Tune how the app curates things for you</p>
                </div>

                <div className="space-y-6">
                    {/* Home section — more settings (actor radar, calendar…) will join here */}
                    <section className="rounded-2xl bg-white/3 border border-white/8 p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                                <House className="h-4.5 w-4.5" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-white">Home page</h2>
                                <p className="text-xs text-gray-500">What shows up in the K-Drama and C-Drama sections</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-400">Excluded tags</h3>
                            <p className="text-xs text-gray-600">
                                Titles carrying any of these MDL tags are hidden from the Top Rated, Airing Now and Coming
                                Soon rows, and from their &ldquo;See more&rdquo; pages.
                            </p>
                        </div>
                        <HomeExcludedTagsSetting initialTags={excludedTags} />
                    </section>

                    <section className="rounded-2xl bg-white/3 border border-white/8 p-6 space-y-5">
                        <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                                <CalendarDays className="h-4.5 w-4.5" />
                            </span>
                            <div>
                                <h2 className="text-base font-bold text-white">Calendar</h2>
                                <p className="text-xs text-gray-500">
                                    What appears in the airing schedule — also adjustable from the calendar page itself
                                </p>
                            </div>
                        </div>
                        <CalendarSettings initialPrefs={calendarPrefs} />
                    </section>

                    {radar && (
                        <section className="rounded-2xl bg-white/3 border border-white/8 p-6 space-y-5">
                            <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                                    <UsersRound className="h-4.5 w-4.5" />
                                </span>
                                <div>
                                    <h2 className="text-base font-bold text-white">Actor radar</h2>
                                    <p className="text-xs text-gray-500">
                                        Who feeds the &ldquo;From Actors You Watch&rdquo; section — add favorites or remove
                                        actors you don&apos;t want recommendations from
                                    </p>
                                </div>
                            </div>
                            <ActorRadarManagePanel scannedActors={radar.scannedActors} excludedActors={radar.excludedActors} />
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
}
