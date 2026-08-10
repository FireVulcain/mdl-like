"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getPaletteWatchlist, type PaletteItem } from "@/actions/palette";
import { fuzzyScore } from "@/lib/fuzzy";
import { DEFAULT_PALETTE_SHORTCUTS, matchesChord } from "@/lib/shortcuts";
import {
    BarChart3,
    Bookmark,
    CalendarDays,
    Clapperboard,
    CornerDownLeft,
    History,
    Home,
    Search,
    Settings,
    Tv,
} from "lucide-react";

type PageEntry = { label: string; href: string; icon: React.ElementType; keywords: string };

const PAGES: PageEntry[] = [
    { label: "Home", href: "/", icon: Home, keywords: "home dashboard airing" },
    { label: "Watchlist", href: "/watchlist", icon: Bookmark, keywords: "watchlist collection my list" },
    { label: "Browse dramas", href: "/dramas", icon: Clapperboard, keywords: "dramas browse discover filter" },
    { label: "Calendar", href: "/calendar", icon: CalendarDays, keywords: "calendar schedule airing episodes" },
    { label: "Stats", href: "/stats", icon: BarChart3, keywords: "stats statistics charts activity" },
    { label: "History", href: "/history", icon: History, keywords: "history activity log" },
    { label: "Settings", href: "/settings", icon: Settings, keywords: "settings preferences options" },
];

export const OPEN_PALETTE_EVENT = "trackr:open-palette";

const MAX_MEDIA_ROWS = 7;
const MAX_PAGE_ROWS = 4;

// `section` is set on the first row of a group and drives its heading, so the
// two groups can swap places without the headings having to be re-derived from
// row positions.
type Row = { key: string; href: string; section: string | null } & (
    | { kind: "media"; item: PaletteItem }
    | { kind: "page"; page: PageEntry }
    | { kind: "search"; query: string }
);

function progressLabel(item: PaletteItem): string {
    const parts: string[] = [];
    if (item.season > 1) parts.push(`S${item.season}`);
    parts.push(item.status);
    if (item.progress > 0) parts.push(item.totalEp ? `${item.progress}/${item.totalEp}` : `ep ${item.progress}`);
    if (item.year) parts.push(String(item.year));
    return parts.join(" · ");
}

export function CommandPalette({ shortcuts = DEFAULT_PALETTE_SHORTCUTS }: { shortcuts?: string[] }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<PaletteItem[] | null>(null);
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    // The index is fetched once per session, not per open — a second ⌘K should
    // never show a spinner for a list that has not changed.
    const loadingRef = useRef(false);

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        try {
            setItems(await getPaletteWatchlist());
        } catch {
            setItems([]); // pages and global search still work without the index
        }
    }, []);

    const openPalette = useCallback(() => {
        setQuery("");
        setActive(0);
        setOpen(true);
        void load();
    }, [load]);

    // Ctrl+P is the browser's print dialog and Ctrl+K its address-bar search,
    // and a page is allowed to claim both with preventDefault. What a page
    // cannot claim is a browser-level binding — Firefox's Ctrl+Shift+P opens a
    // private window before any page sees the event — which is why the default
    // is three chords rather than one. Capture phase, so a focused input never
    // gets first refusal.
    useEffect(() => {
        if (shortcuts.length === 0) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (!shortcuts.some((chord) => matchesChord(e, chord))) return;
            e.preventDefault();
            e.stopPropagation();
            if (open) setOpen(false); // the same chord closes it again
            else openPalette();
        };
        window.addEventListener("keydown", onKeyDown, { capture: true });
        return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
    }, [open, openPalette, shortcuts]);

    // The header's shortcut badge lives in a different subtree, and a window
    // event is cheaper than a provider wrapped around the whole app for one
    // boolean.
    useEffect(() => {
        const onRequest = () => openPalette();
        window.addEventListener(OPEN_PALETTE_EVENT, onRequest);
        return () => window.removeEventListener(OPEN_PALETTE_EVENT, onRequest);
    }, [openPalette]);

    const rows = useMemo<Row[]>(() => {
        const trimmed = query.trim();
        const media = items ?? [];

        const withSection = (group: Row[], heading: string) =>
            group.map((row, i) => ({ ...row, section: i === 0 ? heading : null }));

        if (trimmed.length === 0) {
            // Empty state is the last thing touched, which is the single most
            // likely destination — the palette opens already useful.
            // Only rows that were actually watched. The rest stay in the index
            // for searching, but padding "Recently watched" with titles added
            // and never opened would be a lie.
            const recent: Row[] = media
                .filter((item) => item.watchedAt !== null)
                .slice(0, 5)
                .map((item) => ({ kind: "media" as const, item, key: item.id, href: item.href, section: null }));
            const pages: Row[] = PAGES.slice(0, MAX_PAGE_ROWS).map((page) => ({
                kind: "page" as const,
                page,
                key: page.href,
                href: page.href,
                section: null,
            }));
            return [...withSection(recent, "Recently watched"), ...withSection(pages, "Go to")];
        }

        const scoredMedia = media
            .map((item) => ({ item, score: fuzzyScore(trimmed, item.title) }))
            .filter((m): m is { item: PaletteItem; score: number } => m.score !== null)
            // Seasons of one show all score identically, so the tie-break puts
            // them in season order rather than in whatever order they were last
            // touched — five Breaking Bads shuffled is unreadable.
            .sort((a, b) => b.score - a.score || a.item.season - b.item.season)
            .slice(0, MAX_MEDIA_ROWS);

        const scoredPages = PAGES.map((page) => ({ page, score: fuzzyScore(trimmed, `${page.label} ${page.keywords}`) }))
            .filter((p): p is { page: PageEntry; score: number } => p.score !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_PAGE_ROWS);

        const mediaRows: Row[] = scoredMedia.map(({ item }) => ({ kind: "media", item, key: item.id, href: item.href, section: null }));
        const pageRows: Row[] = scoredPages.map(({ page }) => ({ kind: "page", page, key: page.href, href: page.href, section: null }));

        // Whichever group holds the better match leads. Typing "stats" must not
        // bury the Stats page under six titles that merely contain s, t, a, t, s
        // in that order.
        const bestMedia = scoredMedia[0]?.score ?? -Infinity;
        const bestPage = scoredPages[0]?.score ?? -Infinity;
        const ordered =
            bestPage > bestMedia
                ? [...withSection(pageRows, "Go to"), ...withSection(mediaRows, "Your watchlist")]
                : [...withSection(mediaRows, "Your watchlist"), ...withSection(pageRows, "Go to")];

        return [...ordered, { kind: "search", query: trimmed, key: "search", href: `/search?q=${encodeURIComponent(trimmed)}`, section: null }];
    }, [query, items]);

    const go = useCallback(
        (row: Row) => {
            setOpen(false);
            router.push(row.href);
        },
        [router],
    );

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const row = rows[active];
            if (row) go(row);
        }
    };

    // Keep the highlighted row on screen without scrolling the page behind it.
    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active, rows]);

    const clampedActive = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent
                showCloseButton={false}
                aria-describedby={undefined}
                className="top-[12%] translate-y-0 p-0 gap-0 sm:max-w-xl bg-gray-900 border-white/10 overflow-hidden"
            >
                <DialogTitle className="sr-only">Command palette</DialogTitle>

                <div className="flex items-center gap-3 px-4 h-12 border-b border-white/8">
                    <Search className="h-4 w-4 text-gray-500 shrink-0" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onInputKeyDown}
                        placeholder="Search your watchlist, or jump to a page…"
                        aria-label="Search your watchlist, or jump to a page"
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                    />
                </div>

                <div ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto py-2">
                    {items === null && <p className="px-4 py-6 text-center text-xs text-gray-500">Loading your watchlist…</p>}

                    {items !== null && rows.length === 0 && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Nothing matches that.</p>
                    )}

                    {rows.map((row, i) => {
                        const isActive = i === clampedActive;
                        const PageIcon = row.kind === "page" ? row.page.icon : null;

                        return (
                            <div key={row.key}>
                                {row.section && (
                                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                                        {row.section}
                                    </p>
                                )}
                                <button
                                    data-active={isActive}
                                    onClick={() => go(row)}
                                    onMouseMove={() => setActive(i)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors ${
                                        isActive ? "bg-white/8" : "hover:bg-white/4"
                                    }`}
                                >
                                    {row.kind === "media" && (
                                        <>
                                            <div className="shrink-0 w-7 h-10 rounded overflow-hidden bg-white/5">
                                                {row.item.poster ? (
                                                    <Image
                                                        unoptimized
                                                        src={row.item.poster}
                                                        alt=""
                                                        width={28}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <Tv className="h-3 w-3 text-gray-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm text-white truncate">{row.item.title}</span>
                                                <span className="block text-xs text-gray-500 truncate">{progressLabel(row.item)}</span>
                                            </span>
                                        </>
                                    )}

                                    {row.kind === "page" && PageIcon && (
                                        <>
                                            <span className="shrink-0 w-7 h-10 flex items-center justify-center">
                                                <PageIcon className="h-4 w-4 text-gray-500" />
                                            </span>
                                            <span className="flex-1 min-w-0 text-sm text-white truncate">{row.page.label}</span>
                                        </>
                                    )}

                                    {row.kind === "search" && (
                                        <>
                                            <span className="shrink-0 w-7 h-10 flex items-center justify-center">
                                                <Search className="h-4 w-4 text-gray-500" />
                                            </span>
                                            <span className="flex-1 min-w-0 text-sm text-gray-400 truncate">
                                                Search everywhere for <span className="text-white">{row.query}</span>
                                            </span>
                                        </>
                                    )}

                                    {isActive && <CornerDownLeft className="h-3.5 w-3.5 text-gray-500 shrink-0" />}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4 px-4 h-9 border-t border-white/8 text-[11px] text-gray-600">
                    <span>
                        <kbd className="font-sans text-gray-500">↑↓</kbd> navigate
                    </span>
                    <span>
                        <kbd className="font-sans text-gray-500">↵</kbd> open
                    </span>
                    <span>
                        <kbd className="font-sans text-gray-500">esc</kbd> close
                    </span>
                    {items !== null && items.length > 0 && <span className="ml-auto">{items.length} titles indexed</span>}
                </div>
            </DialogContent>
        </Dialog>
    );
}
