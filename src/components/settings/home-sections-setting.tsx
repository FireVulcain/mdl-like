"use client";

import { useRef, useState } from "react";
import { saveHomeSections } from "@/actions/preferences";
import { homeSectionLabel, type HomeSectionConfig } from "@/lib/home-preferences";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/settings/settings-ui";

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
        <ol className="max-w-lg divide-y divide-line-soft rounded-md bg-surface-1">
            {sections.map((section, index) => (
                <li key={section.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-4 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-faint">{index + 1}</span>
                    <span className={`flex-1 min-w-0 truncate text-sm ${section.enabled ? "text-fg-soft" : "text-fg-dim"}`}>
                        {homeSectionLabel(section.id)}
                    </span>
                    <span className="flex shrink-0 gap-0.5">
                        <button
                            type="button"
                            onClick={() => move(index, -1)}
                            disabled={index === 0}
                            aria-label="Move up"
                            className="grid size-6 cursor-pointer place-items-center rounded text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                        >
                            <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => move(index, 1)}
                            disabled={index === sections.length - 1}
                            aria-label="Move down"
                            className="grid size-6 cursor-pointer place-items-center rounded text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent"
                        >
                            <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                    </span>
                    <Switch
                        label={`Show ${homeSectionLabel(section.id)}`}
                        checked={section.enabled}
                        onChange={() => toggle(index)}
                    />
                </li>
            ))}
        </ol>
    );
}
