"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// The page used to be ten tabs addressed by ?tab=. Links to them still exist
// (the home radar's "Manage" among them), so each old tab lands on the group
// that now holds its settings.
const LEGACY_TABS: Record<string, string> = {
    home: "home",
    watchlist: "lists",
    calendar: "lists",
    radar: "radar",
    display: "general",
    shortcuts: "general",
    profile: "profile",
    notifications: "general",
    jobs: "tools",
    "chart-preview": "tools",
};

/** The sticky contents list beside the settings, marking the group being read. */
export function SettingsIndex({ groups }: { groups: { id: string; title: string }[] }) {
    const [current, setCurrent] = useState(groups[0]?.id);

    useEffect(() => {
        const tab = new URLSearchParams(window.location.search).get("tab");
        const target = (tab && LEGACY_TABS[tab]) || window.location.hash.slice(1);
        if (target) document.getElementById(target)?.scrollIntoView({ block: "start" });

        const sections = groups.map((g) => document.getElementById(g.id)).filter((el): el is HTMLElement => !!el);
        // The band a group has to cross to count as the one being read: below
        // the fixed header, in the upper third of the screen.
        const observer = new IntersectionObserver(
            (entries) => {
                const top = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (top) setCurrent(top.target.id);
            },
            { rootMargin: "-112px 0px -60% 0px" },
        );
        sections.forEach((el) => observer.observe(el));
        return () => observer.disconnect();
    }, [groups]);

    const jump = (id: string) => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        window.history.replaceState(null, "", `/settings#${id}`);
        setCurrent(id);
    };

    return (
        <nav aria-label="Settings sections" className="grid gap-px border-l border-line">
            {groups.map((g) => (
                <button
                    key={g.id}
                    type="button"
                    onClick={() => jump(g.id)}
                    aria-current={current === g.id ? "true" : undefined}
                    className={cn(
                        "-ml-px border-l-2 py-1.25 pl-3.5 text-left text-[13px] transition-colors cursor-pointer",
                        current === g.id ? "border-fg text-fg" : "border-transparent text-fg-dim hover:text-fg",
                    )}
                >
                    {g.title}
                </button>
            ))}
        </nav>
    );
}
