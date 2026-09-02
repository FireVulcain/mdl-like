"use client";

import Link from "next/link";
import { LayoutGrid, Rows3 } from "lucide-react";
import { saveDramasView, type DramasView } from "@/actions/preferences";

const OPTIONS: { value: DramasView; label: string; icon: typeof LayoutGrid }[] = [
    { value: "grid", label: "Grid", icon: LayoutGrid },
    { value: "list", label: "List", icon: Rows3 },
];

// Both halves stay visible rather than one button that swaps meaning, so the
// current view is readable without clicking it.
//
// Navigation is still a plain link — the server renders the view named in the
// URL, no client state involved. The save rides alongside it and is not
// awaited: it decides what the *next* visit opens with, so nothing on screen
// waits for it, and a failed write costs a preference rather than a page.
export function DramasViewToggle({ view, hrefFor }: { view: DramasView; hrefFor: Record<DramasView, string> }) {
    return (
        <div className="flex items-center rounded-lg border border-line-strong bg-surface-1 p-0.5">
            {OPTIONS.map((opt) => {
                const active = view === opt.value;
                const Icon = opt.icon;
                return (
                    <Link
                        key={opt.value}
                        href={hrefFor[opt.value]}
                        onClick={() => { void saveDramasView(opt.value); }}
                        aria-label={opt.label}
                        title={opt.label}
                        aria-current={active ? "true" : undefined}
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-all ${
                            active ? "bg-surface-3 text-fg" : "text-fg-dim hover:text-fg hover:bg-surface-2"
                        }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
