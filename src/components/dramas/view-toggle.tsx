"use client";

import Link from "next/link";
import { saveDramasView, type DramasView } from "@/actions/preferences";
import { VIEW_OPTIONS, viewToggleShell, viewToggleItem } from "@/components/view-toggle";

// Both halves stay visible rather than one button that swaps meaning, so the
// current view is readable without clicking it. The chrome itself is shared
// with the /search switch — see components/view-toggle.tsx.
//
// Navigation is still a plain link — the server renders the view named in the
// URL, no client state involved. The save rides alongside it and is not
// awaited: it decides what the *next* visit opens with, so nothing on screen
// waits for it, and a failed write costs a preference rather than a page.
export function DramasViewToggle({ view, hrefFor }: { view: DramasView; hrefFor: Record<DramasView, string> }) {
    return (
        <div className={viewToggleShell}>
            {VIEW_OPTIONS.map((opt) => {
                const active = view === opt.value;
                const Icon = opt.icon;
                return (
                    <Link
                        key={opt.value}
                        href={hrefFor[opt.value]}
                        onClick={() => {
                            // The skeleton for the next /dramas visit reads this
                            // off <html>. The layout only renders on a full load,
                            // so the click has to carry it in between.
                            document.documentElement.dataset.dramasView = opt.value;
                            void saveDramasView(opt.value);
                        }}
                        aria-label={opt.label}
                        title={opt.label}
                        aria-current={active ? "true" : undefined}
                        className={viewToggleItem(active)}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{opt.label}</span>
                    </Link>
                );
            })}
        </div>
    );
}
