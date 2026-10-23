import {
    getExcludedTagsPreferences,
    getCalendarPreferences,
    getViewPreferences,
    getHomeSections,
    getDisplayPreferences,
    getProfilePreferences,
    getNotificationPreferences,
    getMdlProfileUrl,
    getShortcutPreferences,
} from "@/actions/preferences";
import { getRadarActors } from "@/actions/actor-radar";
import { getCurrentUserId } from "@/lib/session";
import { HomeExcludedTagsSetting } from "@/components/settings/home-excluded-tags";
import { HomeSectionsSetting } from "@/components/settings/home-sections-setting";
import { CalendarSettings } from "@/components/settings/calendar-settings";
import { WatchlistViewSettings } from "@/components/settings/view-settings";
import { DisplaySettings } from "@/components/settings/display-settings";
import { ShortcutSettings } from "@/components/settings/shortcut-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { MdlProfileSetting } from "@/components/settings/mdl-profile-setting";
import { ActorRadarManagePanel } from "@/components/actor-radar-manage";
import { SettingsIndex } from "@/components/settings/settings-index";
import { SettingRow, SettingsGroup } from "@/components/settings/settings-ui";
import { CronStatusPanel } from "@/components/settings/cron-status";
import { ChartPreview } from "@/components/settings/chart-preview";
import { getCronStatus } from "@/actions/cron-status";
import { isAdminUser } from "@/lib/admin";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Settings",
    description: "Tune how the app curates things for you.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
    const [
        userId,
        excludedPrefs,
        calendarPrefs,
        viewPrefs,
        homeSections,
        displayPrefs,
        profilePrefs,
        notifPrefs,
        mdlProfileUrl,
        shortcutPrefs,
        cronJobs,
        isAdmin,
    ] =
        await Promise.all([
            getCurrentUserId().catch(() => null),
            getExcludedTagsPreferences(),
            getCalendarPreferences(),
            getViewPreferences(),
            getHomeSections(),
            getDisplayPreferences(),
            getProfilePreferences(),
            getNotificationPreferences(),
            getMdlProfileUrl(),
            getShortcutPreferences(),
            getCronStatus(),
            isAdminUser(),
        ]);

    let radar: Awaited<ReturnType<typeof getRadarActors>> | null = null;
    try {
        radar = await getRadarActors();
    } catch {
        // Logged out or radar unavailable — the group just doesn't render
    }

    // Six groups on one page. There are barely twenty settings, and as ten tabs
    // two of them (notifications, shortcuts) held a single control each.
    const groups = [
        { id: "general", title: "General", description: "How titles read, what stays hidden, and the keys and banners that work everywhere." },
        { id: "home", title: "Home page", description: "Which sections show, in what order, and the tags that keep titles out." },
        { id: "lists", title: "Watchlist and calendar", description: "How your list opens and what the airing schedule includes." },
        ...(radar ? [{ id: "radar", title: "Actor radar", description: "The actors behind the “From Actors You Watch” section." }] : []),
        { id: "profile", title: "Profile", description: "What visitors see on your page, and the MDL link in the header." },
        { id: "tools", title: "Tools", description: "Reports on the scheduled jobs, and a previewer for chart files." },
    ];
    const group = (id: string) => groups.find((g) => g.id === id)!;

    return (
        // No overflow-hidden here: it makes this box the scroller the index
        // sticks to, and since this box never scrolls the index never stuck.
        <div className="relative min-h-screen">
            <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10">
                <div className="mb-8">
                    <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Settings</h1>
                    <p className="text-fg-dim mt-1">Tune how the app curates things for you</p>
                </div>

                <div className="md:grid md:grid-cols-[170px_minmax(0,1fr)] md:gap-10 md:items-start">
                    <div className="hidden md:block sticky top-28">
                        <SettingsIndex groups={groups.map(({ id, title }) => ({ id, title }))} />
                    </div>

                    <div className="space-y-10 min-w-0">
                        <SettingsGroup {...group("general")}>
                            <DisplaySettings initialPrefs={displayPrefs} />
                            <ShortcutSettings initialShortcuts={shortcutPrefs.commandPaletteShortcuts} />
                            <NotificationSettings initialPrefs={notifPrefs} />
                        </SettingsGroup>

                        <SettingsGroup {...group("home")}>
                            <SettingRow
                                label="Home sections"
                                hint="Choose which sections appear on the home page and in what order. Extra drama universes (Japan, Taiwan, Thailand…) are available here too."
                                wide
                            >
                                <HomeSectionsSetting initialSections={homeSections} />
                            </SettingRow>
                            <SettingRow
                                label="Excluded tags"
                                hint={
                                    <>
                                        Titles carrying any of these MDL tags are hidden from the Top Rated, Airing Now and Coming Soon rows, and from
                                        their &ldquo;See more&rdquo; pages.
                                    </>
                                }
                                wide
                            >
                                <HomeExcludedTagsSetting initialTags={excludedPrefs.tags} initialApplyToBrowse={excludedPrefs.applyToBrowse} />
                            </SettingRow>
                        </SettingsGroup>

                        <SettingsGroup {...group("lists")}>
                            <WatchlistViewSettings initialPrefs={viewPrefs} />
                            <CalendarSettings initialPrefs={calendarPrefs} />
                        </SettingsGroup>

                        {radar && (
                            <SettingsGroup {...group("radar")}>
                                <SettingRow label="Actors" hint="Add an actor to pin them; remove one to keep them out of the section." wide>
                                    <ActorRadarManagePanel scannedActors={radar.scannedActors} excludedActors={radar.excludedActors} />
                                </SettingRow>
                            </SettingsGroup>
                        )}

                        <SettingsGroup
                            {...group("profile")}
                            after={
                                userId && (
                                    <Link href={`/u/${userId}`} className="text-[13px] text-fg-dim transition-colors hover:text-fg">
                                        Preview my public profile
                                    </Link>
                                )
                            }
                        >
                            {userId ? (
                                <ProfileSettings initialPrefs={profilePrefs} />
                            ) : (
                                <p className="py-4 text-sm text-fg-dim">Sign in to manage your public profile.</p>
                            )}
                            <SettingRow
                                label="MyDramaList profile"
                                hint="Adds an MDL shortcut to the header. Leave it empty to hide the link. Paste your profile URL, or just your username."
                                wide
                            >
                                <MdlProfileSetting initialUrl={mdlProfileUrl} />
                            </SettingRow>
                        </SettingsGroup>

                        <SettingsGroup {...group("tools")}>
                            <SettingRow
                                label="Background jobs"
                                hint={
                                    <>
                                        Three schedules, deliberately separate so one cannot starve or hide another. They are configured in Coolify;
                                        nothing here starts them, this only reports what they last wrote.
                                        {isAdmin && (
                                            <>
                                                {" "}What every call to MyDramaList cost, and who made it:{" "}
                                                <Link href="/admin/scraper" className="text-fg-soft underline-offset-2 hover:text-fg hover:underline">
                                                    scraper traffic
                                                </Link>
                                                .
                                            </>
                                        )}
                                    </>
                                }
                                wide
                            >
                                <CronStatusPanel jobs={cronJobs} />
                            </SettingRow>
                            <SettingRow
                                label="Chart preview"
                                hint={
                                    <>
                                        Draw a relationship chart from a JSON file in the format of{" "}
                                        <code className="font-mono">prisma/character-maps/</code>. The file stays in your browser; nothing is saved.
                                    </>
                                }
                                wide
                            >
                                <ChartPreview />
                            </SettingRow>
                        </SettingsGroup>
                    </div>
                </div>
            </div>
        </div>
    );
}
