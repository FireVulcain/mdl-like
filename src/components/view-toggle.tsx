"use client";

import { LayoutGrid, Rows3 } from "lucide-react";
import type { DramasView } from "@/actions/preferences";

// The switch has two shapes across the app — /dramas navigates (the server
// renders the view named in the URL) and /search flips in place (its results
// are accumulated client-side and a navigation would throw them away). The
// chrome is the same either way, so it lives here once and each page brings its
// own <Link> or <button>.
export const VIEW_OPTIONS: { value: DramasView; label: string; icon: typeof LayoutGrid }[] = [
    { value: "grid", label: "Grid", icon: LayoutGrid },
    { value: "list", label: "List", icon: Rows3 },
];

export const viewToggleShell = "flex items-center rounded-lg border border-line-strong bg-surface-1 p-0.5";

export const viewToggleItem = (active: boolean) =>
    `flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all ${
        active ? "bg-surface-3 text-fg" : "text-fg-dim hover:text-fg hover:bg-surface-2"
    }`;

// The in-place variant. Both halves stay visible, same as the /dramas one, so
// the current view is readable without clicking it.
export function ViewToggleButtons({
    view,
    onChange,
    className = "",
}: {
    view: DramasView;
    onChange: (view: DramasView) => void;
    className?: string;
}) {
    return (
        <div className={`${viewToggleShell} ${className}`}>
            {VIEW_OPTIONS.map((opt) => {
                const active = view === opt.value;
                const Icon = opt.icon;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(opt.value)}
                        aria-label={opt.label}
                        title={opt.label}
                        aria-pressed={active}
                        className={`${viewToggleItem(active)} cursor-pointer`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
