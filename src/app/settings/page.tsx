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
import { getActorRadar } from "@/actions/actor-radar";
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
import { SettingsTabs, type SettingsTab } from "@/components/settings/settings-tabs";
import { PageBackground } from "@/components/page-background";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Settings",
    description: "Tune how the app curates things for you.",
};

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    const [
        { tab },
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
    ] =
        await Promise.all([
            searchParams,
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
        ]);

    let radar: Awaited<ReturnType<typeof getActorRadar>> | null = null;
    try {
        radar = await getActorRadar();
    } catch {
        // Logged out or radar unavailable — the tab just doesn't render
    }

    const tabs: SettingsTab[] = [
        { id: "home", label: "Home page", description: "What shows up on the home page, and in what order" },
        { id: "watchlist", label: "Watchlist", description: "Default view and behaviors of your watchlist" },
        { id: "calendar", label: "Calendar", description: "What appears in the airing schedule — also adjustable from the calendar page" },
        ...(radar ? [{ id: "radar", label: "Actor radar", description: "Who feeds the “From Actors You Watch” section" }] : []),
        { id: "display", label: "Display", description: "How titles and episode details are shown across the app" },
        { id: "shortcuts", label: "Shortcuts", description: "Keys that open the command palette" },
        { id: "profile", label: "Public profile", description: "What visitors can see on your profile page" },
        { id: "notifications", label: "Notifications", description: "In-app banners and reminders" },
    ];

    const panels: Record<string, React.ReactNode> = {
        home: (
            <div className="divide-y divide-white/8">
                <div className="space-y-2.5 pb-5">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sections</h3>
                    <p className="text-xs text-gray-600">
                        Choose which sections appear on the home page and in what order. Extra drama universes (Japan,
                        Taiwan, Thailand…) are available here too.
                    </p>
                    <HomeSectionsSetting initialSections={homeSections} />
                </div>
                <div className="space-y-4 pt-5">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Excluded tags</h3>
                        <p className="text-xs text-gray-600">
                            Titles carrying any of these MDL tags are hidden from the Top Rated, Airing Now and Coming
                            Soon rows, and from their &ldquo;See more&rdquo; pages.
                        </p>
                    </div>
                    <HomeExcludedTagsSetting initialTags={excludedPrefs.tags} initialApplyToBrowse={excludedPrefs.applyToBrowse} />
                </div>
            </div>
        ),
        watchlist: <WatchlistViewSettings initialPrefs={viewPrefs} />,
        calendar: <CalendarSettings initialPrefs={calendarPrefs} />,
        ...(radar
            ? { radar: <ActorRadarManagePanel scannedActors={radar.scannedActors} excludedActors={radar.excludedActors} /> }
            : {}),
        display: (
            <div className="divide-y divide-white/8">
                <div className="pb-5">
                    <DisplaySettings initialPrefs={displayPrefs} />
                </div>
                <div className="pt-5">
                    <MdlProfileSetting initialUrl={mdlProfileUrl} />
                </div>
            </div>
        ),
        shortcuts: <ShortcutSettings initialShortcuts={shortcutPrefs.commandPaletteShortcuts} />,
        profile: userId ? (
            <ProfileSettings initialPrefs={profilePrefs} profileUserId={userId} />
        ) : (
            <p className="text-sm text-gray-500">Sign in to manage your public profile.</p>
        ),
        notifications: <NotificationSettings initialPrefs={notifPrefs} />,
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            <PageBackground />

            <div className="container py-8 px-4 mx-auto max-w-5xl relative z-10">
                <div className="mb-8">
                    <h1 className="font-display text-3xl font-bold tracking-tight text-white">Settings</h1>
                    <p className="text-gray-500 mt-1">Tune how the app curates things for you</p>
                </div>

                <SettingsTabs tabs={tabs} panels={panels} initialTab={tab} />
            </div>
        </div>
    );
}
