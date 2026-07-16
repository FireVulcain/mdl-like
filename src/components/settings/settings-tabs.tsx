"use client";

import { useState, type ReactNode } from "react";
import { Bell, Bookmark, CalendarDays, House, MonitorPlay, UserRound, UsersRound, type LucideIcon } from "lucide-react";

const TAB_ICONS: Record<string, LucideIcon> = {
    home: House,
    watchlist: Bookmark,
    calendar: CalendarDays,
    radar: UsersRound,
    display: MonitorPlay,
    profile: UserRound,
    notifications: Bell,
};

export type SettingsTab = { id: string; label: string; description: string };

// Tabbed shell: vertical nav on desktop, horizontal pills on mobile. The active
// tab is mirrored in the URL (?tab=) so it survives reloads and deep links.
export function SettingsTabs({
    tabs,
    panels,
    initialTab,
}: {
    tabs: SettingsTab[];
    panels: Record<string, ReactNode>;
    initialTab?: string;
}) {
    const [active, setActive] = useState(tabs.some((t) => t.id === initialTab) ? initialTab! : tabs[0].id);

    const select = (id: string) => {
        setActive(id);
        const params = new URLSearchParams(window.location.search);
        params.set("tab", id);
        window.history.replaceState(null, "", `?${params.toString()}`);
    };

    const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

    return (
        <div className="md:grid md:grid-cols-[210px_1fr] md:gap-8">
            {/* Nav */}
            <nav className="mb-5 md:mb-0">
                <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:sticky md:top-28">
                    {tabs.map((tab) => {
                        const Icon = TAB_ICONS[tab.id];
                        const isActive = tab.id === active;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => select(tab.id)}
                                className={`cursor-pointer flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                    isActive ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                            >
                                {Icon && <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-blue-400" : ""}`} />}
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* Panel */}
            <div className="min-w-0">
                <div className="mb-5">
                    <h2 className="text-lg font-bold text-white">{activeTab.label}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{activeTab.description}</p>
                </div>
                <div className="rounded-2xl bg-white/3 border border-white/8 p-6">{panels[active]}</div>
            </div>
        </div>
    );
}
