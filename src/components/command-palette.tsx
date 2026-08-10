"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getPaletteWatchlist, undoLastProgress, type PaletteItem } from "@/actions/palette";
import { updateUserMedia, deleteUserMedia } from "@/actions/media";
import { fuzzyScore } from "@/lib/fuzzy";
import { DEFAULT_PALETTE_SHORTCUTS, matchesChord } from "@/lib/shortcuts";
import {
    BarChart3,
    Bookmark,
    CalendarDays,
    ChevronRight,
    Clapperboard,
    CheckCheck,
    CornerDownLeft,
    History,
    Home,
    ListChecks,
    Play,
    RotateCcw,
    Search,
    Settings,
    Star,
    Trash2,
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

const WATCH_STATUSES = ["Watching", "Completed", "On Hold", "Dropped", "Plan to Watch"];

export const OPEN_PALETTE_EVENT = "trackr:open-palette";

const MAX_MEDIA_ROWS = 7;
const MAX_PAGE_ROWS = 4;

/**
 * Three levels, in the sense the palette is usually built:
 *   root    — search everything
 *   item    — one title's actions, reached with → or Tab, or straight away when
 *             the palette is opened from that title's own page
 *   prompt  — a value the action still needs (which episode, which score), or a
 *             confirmation for something destructive
 */
type Mode =
    | { kind: "root" }
    | { kind: "item"; item: PaletteItem }
    | { kind: "status"; item: PaletteItem }
    | { kind: "prompt"; item: PaletteItem; field: "episode" | "score" }
    | { kind: "confirm"; item: PaletteItem };

type Row = { key: string; section: string | null } & (
    | { kind: "media"; item: PaletteItem }
    | { kind: "page"; page: PageEntry }
    | { kind: "search"; query: string }
    | { kind: "command"; label: string; icon: React.ElementType; keywords: string; danger?: boolean; run: () => void }
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
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>({ kind: "root" });
    const [query, setQuery] = useState("");
    const [items, setItems] = useState<PaletteItem[] | null>(null);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // The index is fetched once per session, not per open — a second ⌘K should
    // never show a spinner for a list that has not changed.
    const loadingRef = useRef(false);
    // Read inside the open handler, which must not re-subscribe on every
    // navigation just to know where it was opened from.
    const locationRef = useRef({ pathname, season: searchParams.get("season") });
    locationRef.current = { pathname, season: searchParams.get("season") };
    const itemsRef = useRef<PaletteItem[] | null>(null);
    itemsRef.current = items;
    const queryRef = useRef("");
    queryRef.current = query;

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        try {
            const fetched = await getPaletteWatchlist();
            itemsRef.current = fetched;
            setItems(fetched);
        } catch {
            setItems([]); // pages and global search still work without the index
        }
    }, []);

    /** The watchlist row for the media page currently on screen, if any. */
    const itemForCurrentPage = useCallback((list: PaletteItem[] | null) => {
        const { pathname: path, season } = locationRef.current;
        const match = path.match(/^\/media\/([^/]+)$/);
        if (!match || !list) return null;
        const wanted = season && season !== "1" ? `/media/${match[1]}?season=${season}` : `/media/${match[1]}`;
        return list.find((item) => item.href === wanted) ?? null;
    }, []);

    const openPalette = useCallback(() => {
        setQuery("");
        setActive(0);
        // Opened from a title's own page: skip the search nobody needs to type
        // and land straight on that title's actions.
        const scoped = itemForCurrentPage(itemsRef.current);
        setMode(scoped ? { kind: "item", item: scoped } : { kind: "root" });
        setOpen(true);
        void load().then(() => {
            // The very first open races the index fetch, so the scoping is
            // retried once it lands — but never on top of something typed in
            // the meantime.
            if (scoped || queryRef.current.length > 0) return;
            const late = itemForCurrentPage(itemsRef.current);
            if (late) setMode({ kind: "item", item: late });
        });
    }, [load, itemForCurrentPage]);

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

    const close = useCallback(() => {
        setOpen(false);
        setMode({ kind: "root" });
        setQuery("");
    }, []);

    const goTo = useCallback(
        (href: string) => {
            close();
            router.push(href);
        },
        [close, router],
    );

    /**
     * Every write goes through here: patch the local index so the palette shows
     * the new state before the round trip finishes, then refresh so the page
     * behind agrees. On failure the index is reloaded rather than rolled back by
     * hand — the server is the only thing that knows what actually landed.
     */
    const commit = useCallback(
        async (item: PaletteItem, patch: Partial<PaletteItem>, run: () => Promise<unknown>, message: string) => {
            setBusy(true);
            setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) ?? prev);
            try {
                await run();
                toast.success(message);
                router.refresh();
            } catch {
                toast.error("That didn't go through");
                loadingRef.current = false;
                void load();
            } finally {
                setBusy(false);
            }
        },
        [router, load],
    );

    const setProgress = useCallback(
        (item: PaletteItem, episode: number) => {
            close();
            void commit(
                item,
                { progress: episode },
                () => updateUserMedia(item.id, { progress: episode }),
                `${item.title} · episode ${episode} watched`,
            );
        },
        [close, commit],
    );

    const setStatus = useCallback(
        (item: PaletteItem, status: string) => {
            close();
            void commit(item, { status }, () => updateUserMedia(item.id, { status }), `${item.title} · ${status}`);
        },
        [close, commit],
    );

    const setScore = useCallback(
        (item: PaletteItem, score: number) => {
            close();
            void commit(item, {}, () => updateUserMedia(item.id, { score }), `${item.title} rated ${score}`);
        },
        [close, commit],
    );

    const remove = useCallback(
        (item: PaletteItem) => {
            close();
            setItems((prev) => prev?.filter((i) => i.id !== item.id) ?? prev);
            void commit(item, {}, () => deleteUserMedia(item.id), `${item.title} removed from your list`);
        },
        [close, commit],
    );

    const undo = useCallback(async () => {
        close();
        setBusy(true);
        try {
            const result = await undoLastProgress();
            if (result.ok) {
                loadingRef.current = false;
                await load();
                router.refresh();
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } finally {
            setBusy(false);
        }
    }, [close, load, router]);

    // Changing level always resets the query and the cursor: the text that found
    // a title is meaningless against a list of verbs.
    const enterMode = useCallback((next: Mode) => {
        setMode(next);
        setQuery("");
        // Confirmation opens on Cancel. Two keystrokes should not be enough to
        // delete the wrong title, and the row that deletes is never the one
        // already under the cursor.
        setActive(next.kind === "confirm" ? 1 : 0);
        inputRef.current?.focus();
    }, []);

    const itemActions = useCallback(
        (item: PaletteItem): Row[] => {
            const rows: Row[] = [];
            const next = item.progress + 1;
            const remaining = item.totalEp ? item.totalEp - item.progress : null;

            rows.push({
                kind: "command",
                key: "open",
                section: null,
                label: "Open page",
                icon: ChevronRight,
                keywords: "open go to page view",
                run: () => goTo(item.href),
            });

            if (remaining === null || remaining > 0) {
                rows.push({
                    kind: "command",
                    key: "next-ep",
                    section: null,
                    label: `Mark episode ${next} watched`,
                    icon: Play,
                    keywords: "mark episode watched next progress",
                    run: () => setProgress(item, next),
                });
            }

            if (remaining !== null && remaining > 1) {
                rows.push({
                    kind: "command",
                    key: "all-eps",
                    section: null,
                    label: `Mark all ${item.totalEp} episodes watched`,
                    icon: CheckCheck,
                    keywords: "mark all episodes watched season finish complete",
                    run: () => setProgress(item, item.totalEp!),
                });
            }

            rows.push({
                kind: "command",
                key: "pick-ep",
                section: null,
                label: "Mark a specific episode…",
                icon: ListChecks,
                keywords: "mark episode number specific set progress",
                run: () => enterMode({ kind: "prompt", item, field: "episode" }),
            });

            rows.push({
                kind: "command",
                key: "status",
                section: null,
                label: "Change status…",
                icon: Bookmark,
                keywords: "status watching completed dropped hold plan move",
                run: () => enterMode({ kind: "status", item }),
            });

            rows.push({
                kind: "command",
                key: "rate",
                section: null,
                label: "Rate…",
                icon: Star,
                keywords: "rate rating score",
                run: () => enterMode({ kind: "prompt", item, field: "score" }),
            });

            rows.push({
                kind: "command",
                key: "remove",
                section: null,
                label: "Remove from my list",
                icon: Trash2,
                keywords: "remove delete drop off list",
                danger: true,
                run: () => enterMode({ kind: "confirm", item }),
            });

            return rows;
        },
        [goTo, setProgress, enterMode],
    );

    const rows = useMemo<Row[]>(() => {
        const trimmed = query.trim();
        const media = items ?? [];

        const withSection = (group: Row[], heading: string) =>
            group.map((row, i) => ({ ...row, section: i === 0 ? heading : null }));

        // Returns the surviving rows plus the group's best score, so groups can
        // be ranked against each other rather than sitting in a fixed order.
        const filterByQuery = (group: Row[]): { rows: Row[]; best: number } => {
            if (trimmed.length === 0) return { rows: group, best: 0 };
            const scored = group
                .map((row) => ({ row, score: row.kind === "command" ? fuzzyScore(trimmed, `${row.label} ${row.keywords}`) : 0 }))
                .filter((r): r is { row: Row; score: number } => r.score !== null)
                .sort((a, b) => b.score - a.score);
            return { rows: scored.map((r) => r.row), best: scored[0]?.score ?? -Infinity };
        };

        if (mode.kind === "confirm") {
            return [
                {
                    kind: "command",
                    key: "confirm-yes",
                    section: null,
                    label: `Yes, remove ${mode.item.title}`,
                    icon: Trash2,
                    keywords: "yes confirm remove delete",
                    danger: true,
                    run: () => remove(mode.item),
                },
                {
                    kind: "command",
                    key: "confirm-no",
                    section: null,
                    label: "Cancel",
                    icon: RotateCcw,
                    keywords: "no cancel back",
                    run: () => enterMode({ kind: "item", item: mode.item }),
                },
            ];
        }

        if (mode.kind === "status") {
            return WATCH_STATUSES.map((status) => ({
                kind: "command" as const,
                key: `status-${status}`,
                section: null,
                label: status === mode.item.status ? `${status} (current)` : status,
                icon: Bookmark,
                keywords: `status ${status}`,
                run: () => setStatus(mode.item, status),
            })).filter((row) => (trimmed ? fuzzyScore(trimmed, row.label) !== null : true));
        }

        if (mode.kind === "prompt") return []; // the input is the whole interface

        if (mode.kind === "item") return filterByQuery(itemActions(mode.item)).rows;

        if (trimmed.length === 0) {
            // Empty state is the last thing touched, which is the single most
            // likely destination — the palette opens already useful.
            // Only rows that were actually watched. The rest stay in the index
            // for searching, but padding "Recently watched" with titles added
            // and never opened would be a lie.
            const recent: Row[] = media
                .filter((item) => item.watchedAt !== null)
                .slice(0, 5)
                .map((item) => ({ kind: "media" as const, item, key: item.id, section: null }));
            const pages: Row[] = PAGES.slice(0, MAX_PAGE_ROWS).map((page) => ({
                kind: "page" as const,
                page,
                key: page.href,
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

        const commands = filterByQuery([
            {
                kind: "command",
                key: "undo",
                section: null,
                label: "Undo last watched episode",
                icon: RotateCcw,
                keywords: "undo revert last watched episode mistake",
                run: () => void undo(),
            },
        ]);

        // Every group is ranked by its own best match, so whichever one holds
        // the strongest hit leads. Typing "stats" must not bury the Stats page
        // under six titles that merely contain s, t, a, t, s in that order, and
        // typing "undo" must not bury the Undo command under "Undercover".
        const groups: { rows: Row[]; best: number; heading: string }[] = [
            {
                rows: scoredMedia.map(({ item }) => ({ kind: "media", item, key: item.id, section: null })),
                best: scoredMedia[0]?.score ?? -Infinity,
                heading: "Your watchlist",
            },
            {
                rows: scoredPages.map(({ page }) => ({ kind: "page", page, key: page.href, section: null })),
                best: scoredPages[0]?.score ?? -Infinity,
                heading: "Go to",
            },
            { rows: commands.rows, best: commands.best, heading: "Commands" },
        ];

        const ordered = groups
            .filter((g) => g.rows.length > 0)
            .sort((a, b) => b.best - a.best)
            .flatMap((g) => withSection(g.rows, g.heading));

        return [...ordered, { kind: "search", query: trimmed, key: "search", section: null }];
    }, [query, items, mode, itemActions, remove, setStatus, undo, enterMode]);

    const clampedActive = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

    const runRow = useCallback(
        (row: Row) => {
            if (row.kind === "media") goTo(row.item.href);
            else if (row.kind === "page") goTo(row.page.href);
            else if (row.kind === "search") goTo(`/search?q=${encodeURIComponent(row.query)}`);
            else row.run();
        },
        [goTo],
    );

    const back = useCallback(() => {
        if (mode.kind === "root") {
            close();
            return;
        }
        if (mode.kind === "item") {
            enterMode({ kind: "root" });
            return;
        }
        enterMode({ kind: "item", item: mode.item });
    }, [mode, close, enterMode]);

    const submitPrompt = () => {
        if (mode.kind !== "prompt") return;
        const value = Number(query.trim().replace(",", "."));
        if (!Number.isFinite(value)) return;

        if (mode.field === "episode") {
            const max = mode.item.totalEp ?? Number.MAX_SAFE_INTEGER;
            if (value < 0 || value > max || !Number.isInteger(value)) return;
            setProgress(mode.item, value);
        } else {
            if (value < 0 || value > 10) return;
            setScore(mode.item, value);
        }
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (mode.kind === "prompt") submitPrompt();
            else {
                const row = rows[clampedActive];
                if (row) runRow(row);
            }
        } else if (e.key === "Tab" || (e.key === "ArrowRight" && query.length === 0)) {
            // → only drills in from an empty field, so it stays a cursor key
            // while there is text to move through.
            const row = rows[clampedActive];
            if (mode.kind === "root" && row?.kind === "media") {
                e.preventDefault();
                enterMode({ kind: "item", item: row.item });
            }
        } else if (e.key === "Backspace" && query.length === 0 && mode.kind !== "root") {
            e.preventDefault();
            back();
        } else if (e.key === "ArrowLeft" && query.length === 0 && mode.kind !== "root") {
            e.preventDefault();
            back();
        }
        // Escape is handled by the dialog's own onEscapeKeyDown: Radix listens
        // on document, above the React root, so stopping the synthetic event
        // here would never reach it.
    };

    // Keep the highlighted row on screen without scrolling the page behind it.
    useEffect(() => {
        listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
    }, [active, rows]);

    const scopedItem = mode.kind === "root" ? null : mode.item;
    const placeholder =
        mode.kind === "prompt"
            ? mode.field === "episode"
                ? `Episode number${mode.item.totalEp ? ` (1–${mode.item.totalEp})` : ""}…`
                : "Score out of 10…"
            : mode.kind === "status"
              ? "Pick a status…"
              : mode.kind === "confirm"
                ? "This cannot be undone"
                : mode.kind === "item"
                  ? "What would you like to do?"
                  : "Search your watchlist, or jump to a page…";

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                aria-describedby={undefined}
                onEscapeKeyDown={(e) => {
                    // Inside a sub-level, escape means "up one", not "close".
                    if (mode.kind !== "root") {
                        e.preventDefault();
                        back();
                    }
                }}
                className="top-[12%] translate-y-0 p-0 gap-0 sm:max-w-xl bg-gray-900 border-white/10 overflow-hidden"
            >
                <DialogTitle className="sr-only">Command palette</DialogTitle>

                <div className="flex items-center gap-2 px-4 h-12 border-b border-white/8">
                    {scopedItem ? (
                        <button
                            onClick={back}
                            className="shrink-0 flex items-center gap-1.5 max-w-[45%] px-2 py-1 -ml-2 rounded-md bg-white/8 text-xs font-medium text-white hover:bg-white/12 transition-colors cursor-pointer"
                        >
                            <span className="truncate">{scopedItem.title}</span>
                            {scopedItem.season > 1 && <span className="text-gray-400">S{scopedItem.season}</span>}
                        </button>
                    ) : (
                        <Search className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        autoFocus
                        value={query}
                        inputMode={mode.kind === "prompt" ? "decimal" : "text"}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onInputKeyDown}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-gray-500 outline-none"
                    />
                    {busy && <div className="h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin shrink-0" />}
                </div>

                <div ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto py-2">
                    {items === null && mode.kind === "root" && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Loading your watchlist…</p>
                    )}

                    {mode.kind === "prompt" && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">
                            {mode.field === "episode"
                                ? `Currently at ${mode.item.progress}${mode.item.totalEp ? ` of ${mode.item.totalEp}` : ""}. Type a number and press Enter.`
                                : "Type a score from 1 to 10 — decimals allowed — and press Enter."}
                        </p>
                    )}

                    {items !== null && rows.length === 0 && mode.kind !== "prompt" && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Nothing matches that.</p>
                    )}

                    {rows.map((row, i) => {
                        const isActive = i === clampedActive;
                        const RowIcon = row.kind === "page" ? row.page.icon : row.kind === "command" ? row.icon : null;
                        const danger = row.kind === "command" && row.danger;

                        return (
                            <div key={row.key}>
                                {row.section && (
                                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                                        {row.section}
                                    </p>
                                )}
                                <button
                                    data-active={isActive}
                                    onClick={() => runRow(row)}
                                    onMouseMove={() => setActive(i)}
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left cursor-pointer transition-colors ${
                                        isActive ? "bg-white/8" : "hover:bg-white/4"
                                    }`}
                                >
                                    {row.kind === "media" ? (
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
                                    ) : (
                                        <>
                                            <span className="shrink-0 w-7 h-10 flex items-center justify-center">
                                                {RowIcon ? (
                                                    <RowIcon className={`h-4 w-4 ${danger ? "text-rose-400/80" : "text-gray-500"}`} />
                                                ) : (
                                                    <Search className="h-4 w-4 text-gray-500" />
                                                )}
                                            </span>
                                            <span className={`flex-1 min-w-0 text-sm truncate ${danger ? "text-rose-300" : "text-white"}`}>
                                                {row.kind === "search" ? (
                                                    <>
                                                        <span className="text-gray-400">Search everywhere for </span>
                                                        {row.query}
                                                    </>
                                                ) : row.kind === "page" ? (
                                                    row.page.label
                                                ) : (
                                                    row.label
                                                )}
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
                        <kbd className="font-sans text-gray-500">↵</kbd> {mode.kind === "root" ? "open" : "run"}
                    </span>
                    {mode.kind === "root" ? (
                        <span>
                            <kbd className="font-sans text-gray-500">tab</kbd> actions
                        </span>
                    ) : (
                        <span>
                            <kbd className="font-sans text-gray-500">esc</kbd> back
                        </span>
                    )}
                    {mode.kind === "root" && items !== null && items.length > 0 && (
                        <span className="ml-auto">{items.length} titles indexed</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
