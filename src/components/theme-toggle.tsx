"use client";

import { useRef, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { getThemeServerSnapshot, getThemeSnapshot, subscribeTheme, switchTheme, type Theme } from "@/lib/theme";

/**
 * The theme switch.
 *
 * Reads the theme off the document rather than holding its own copy: the
 * pre-paint script has already written it before React exists, so any state
 * here could only disagree with what the reader is looking at.
 *
 * The server can never know the choice — it lives in localStorage — so the
 * first render says dark, matching what was sent, and the real value arrives
 * one render later. Only this icon settles a frame late; the page itself was
 * styled correctly before it ever painted.
 */
export function ThemeToggle() {
    const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const next: Theme = theme === "dark" ? "light" : "dark";

    return (
        <button
            ref={buttonRef}
            type="button"
            onClick={() => void switchTheme(next, buttonRef.current)}
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
            className="cursor-pointer relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
            {/* Both mounted and cross-faded rather than swapped, so the icon does
                not pop out and back in while the circle is still sweeping. */}
            <Sun
                className={`absolute size-4 transition-all duration-300 ${theme === "light" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`}
            />
            <Moon
                className={`absolute size-4 transition-all duration-300 ${theme === "dark" ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"}`}
            />
        </button>
    );
}
