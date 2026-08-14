"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useEffect, useTransition } from "react";
import { OPEN_PALETTE_EVENT } from "@/components/command-palette";
import { formatChord } from "@/lib/shortcuts";
import { Command } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

export function SearchInput({ autoFocus, paletteShortcut }: { autoFocus?: boolean; paletteShortcut?: string | null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);

    // Store the page the user was on before searching
    const previousPathRef = useRef<string | null>(null);

    // Track the path when not on search page
    useEffect(() => {
        if (pathname !== "/search") {
            previousPathRef.current = pathname;
        }
    }, [pathname]);

    useEffect(() => {
        if (autoFocus) {
            // Small delay to let the overlay animation settle before focusing
            const t = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
    }, [autoFocus]);

    const handleSearch = useDebouncedCallback((term: string) => {
        if (term) {
            const params = new URLSearchParams(searchParams);
            params.set("q", term);
            startTransition(() => {
                router.replace(`/search?${params.toString()}`);
            });
        } else {
            // Navigate back to previous page or home
            startTransition(() => {
                router.replace(previousPathRef.current || "/");
            });
        }
    }, 300);

    // `undefined` means the caller never opted in — the mobile overlay copy has
    // no room for a badge beside an autofocused field.
    const showPaletteBadge = paletteShortcut !== undefined;

    return (
        <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
                ref={inputRef}
                type="search"
                // Named and opted out of autofill: Chrome reports an unnamed
                // form field as an issue, and an anonymous one is a field the
                // browser's heuristics are free to guess about — offering saved
                // addresses over a drama search.
                name="site-search"
                autoComplete="off"
                aria-label="Search dramas and movies"
                placeholder="Search dramas, movies..."
                className={`pl-10 ${showPaletteBadge ? "pr-24" : ""} h-10 bg-white/5 border-white/5 rounded-xl focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all placeholder:text-muted-foreground/50`}
                onChange={(e) => handleSearch(e.target.value)}
                defaultValue={searchParams.get("q")?.toString()}
            />
            {/* The only thing that makes a keyboard feature discoverable. The
                label follows whatever chord is configured, and falls back to the
                ⌘ glyph when the user has cleared every shortcut — the button is
                then the only way in. */}
            {showPaletteBadge && (
                <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT))}
                    title="Open the command palette"
                    aria-label="Open the command palette"
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-white/5 text-[11px] font-medium text-muted-foreground/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap flex items-center"
                >
                    {paletteShortcut ? formatChord(paletteShortcut).replace(/ \+ /g, " ") : <Command className="h-3 w-3" />}
                </button>
            )}
        </div>
    );
}
