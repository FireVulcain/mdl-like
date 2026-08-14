"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef, useEffect, useLayoutEffect, useTransition } from "react";
import { OPEN_PALETTE_EVENT } from "@/components/command-palette";
import { formatChord } from "@/lib/shortcuts";
import { Command } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

// The measurement below has to land before the browser paints, or the field
// shows the guessed padding for a frame and then snaps. useLayoutEffect warns
// when it runs during SSR, though, and this component is server-rendered, so it
// steps down to useEffect there — where there is no layout to measure anyway.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

    // The badge overlaps the field, so the text has to be pushed clear of it.
    // That was a fixed pr-24 — 96px reserved for a badge that measures about 50
    // with "Ctrl K". The header field is capped at max-w-xs, and this Input
    // renders at 16px (the base keeps md:text-base, so it never steps down to
    // 14), which left roughly 184px of the 320 for the placeholder: not quite
    // enough, so it came out clipped mid-word. A guessed constant cannot be
    // right anyway — the chord is configurable, and "Ctrl Shift P" is nearly
    // twice as wide as "Ctrl K" — so measure it instead. Written to the node
    // rather than through state: it is a measurement feeding back into layout,
    // and a render pass in between would only show the wrong padding first.
    const badgeRef = useRef<HTMLButtonElement>(null);
    useIsomorphicLayoutEffect(() => {
        const input = inputRef.current;
        const badge = badgeRef.current;
        if (!input) return;
        input.style.paddingRight = badge ? `${badge.offsetWidth + 16}px` : "";
    }, [paletteShortcut]);

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
                // No trailing ellipsis. Against the right edge of a field this
                // narrow it reads as the text having been cut off rather than as
                // an invitation, which is exactly the thing being fixed.
                placeholder="Search dramas, movies"
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
                    ref={badgeRef}
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
