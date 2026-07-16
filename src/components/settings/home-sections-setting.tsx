"use client";

import { useRef, useState } from "react";
import { saveHomeSections } from "@/actions/preferences";
import { homeSectionLabel, type HomeSectionConfig } from "@/lib/home-preferences";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

// Order + visibility of the home page sections. Saves on change (debounced so
// spamming the arrows doesn't fire a request per click).
export function HomeSectionsSetting({ initialSections }: { initialSections: HomeSectionConfig[] }) {
    const [sections, setSections] = useState<HomeSectionConfig[]>(initialSections);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const update = (next: HomeSectionConfig[]) => {
        setSections(next);
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(async () => {
            try {
                await saveHomeSections(next);
                toast.success("Home layout saved");
            } catch {
                toast.error("Failed to save home layout");
            }
        }, 600);
    };

    const move = (index: number, delta: -1 | 1) => {
        const target = index + delta;
        if (target < 0 || target >= sections.length) return;
        const next = [...sections];
        [next[index], next[target]] = [next[target], next[index]];
        update(next);
    };

    const toggle = (index: number) => {
        const next = sections.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s));
        update(next);
    };

    return (
        <div className="rounded-lg border border-white/10 divide-y divide-white/5">
            {sections.map((section, index) => (
                <div key={section.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="flex flex-col shrink-0">
                        <button
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="cursor-pointer text-gray-500 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => move(index, 1)}
                            disabled={index === sections.length - 1}
                            aria-label="Move down"
                            className="cursor-pointer text-gray-500 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                    </div>

                    <span className={`flex-1 min-w-0 truncate text-sm ${section.enabled ? "text-gray-200" : "text-gray-500"}`}>
                        {homeSectionLabel(section.id)}
                    </span>

                    <button
                        onClick={() => toggle(index)}
                        aria-label={section.enabled ? "Hide section" : "Show section"}
                        className="cursor-pointer shrink-0"
                    >
                        <span className={`relative block h-5 w-9 rounded-full transition-colors ${section.enabled ? "bg-blue-500" : "bg-white/10"}`}>
                            <span
                                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                                    section.enabled ? "left-4.5" : "left-0.5"
                                }`}
                            />
                        </span>
                    </button>
                </div>
            ))}
        </div>
    );
}
