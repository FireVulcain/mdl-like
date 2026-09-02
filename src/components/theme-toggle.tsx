"use client";

import { useRef } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { themeTransition } from "@/lib/theme";
import { saveThemePreference } from "@/actions/preferences";

/**
 * The theme switch.
 *
 * State belongs to next-themes, which owned the theme before this button
 * existed: it writes the class, remembers the choice, and applies it before the
 * first paint. This adds the circle and nothing else.
 *
 * Which icon shows is decided in CSS, by the same class next-themes writes,
 * rather than by asking React what the theme is. The usual `mounted` guard
 * renders the wrong icon for one frame after hydration — the server cannot know
 * a choice kept in localStorage — whereas a variant is right on the first
 * paint, before React has run at all.
 */
export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <button
            ref={buttonRef}
            type="button"
            // Read at click time, which is always after hydration, so no guard
            // is needed for the behaviour either.
            onClick={() => {
                const next = resolvedTheme === "light" ? "dark" : "light";
                void themeTransition(() => setTheme(next), buttonRef.current);
                // Not awaited: next-themes has already painted, and this copy
                // only decides what a browser with no stored choice opens with.
                void saveThemePreference(next);
            }}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="cursor-pointer relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
            {/* Both mounted and cross-faded rather than swapped, so the icon does
                not pop out and back in while the circle is still sweeping. */}
            <Sun className="absolute size-4 -rotate-90 scale-0 opacity-0 transition-all duration-300 light:rotate-0 light:scale-100 light:opacity-100" />
            <Moon className="absolute size-4 rotate-0 scale-100 opacity-100 transition-all duration-300 light:rotate-90 light:scale-0 light:opacity-0" />
        </button>
    );
}
