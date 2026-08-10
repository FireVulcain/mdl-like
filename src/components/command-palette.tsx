"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    getAiringToday,
    getPaletteStats,
    getPalettePeople,
    getPaletteWatchlist,
    undoLastProgress,
    type PaletteAiringEntry,
    type PaletteItem,
    type PalettePerson,
    type PaletteStat,
} from "@/actions/palette";
import { updateUserMedia, deleteUserMedia } from "@/actions/media";
import { fuzzyScore } from "@/lib/fuzzy";
import { DEFAULT_PALETTE_SHORTCUTS, matchesChord } from "@/lib/shortcuts";
import { doneProgress, startProgress } from "@/lib/progress-events";
import {
    BarChart3,
    Bookmark,
    CalendarDays,
    ChevronRight,
    Clapperboard,
    CheckCheck,
    CircleQuestionMark,
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
    User,
    Users,
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
const MAX_PEOPLE_ROWS = 5;
const MAX_PAGE_ROWS = 4;

/**
 * Three levels, in the sense the palette is usually built:
 *   root    — search everything
 *   item    — one title's actions, reached with → or Tab
 *   prompt  — a value the action still needs (which episode, which score), or a
 *             confirmation for something destructive
 */
/**
 * The three menus keep the root list short: one row each, none of which appears
 * until the query asks for it. Ten "Show my …" rows would be the same features
 * and a worse palette.
 */
type MenuId = "list" | "airing" | "stats" | "help";

type Mode =
    | { kind: "root" }
    | { kind: "menu"; menu: MenuId }
    | { kind: "item"; item: PaletteItem }
    | { kind: "person"; person: PalettePerson }
    | { kind: "cast"; item: PaletteItem }
    | { kind: "status"; item: PaletteItem }
    | { kind: "prompt"; item: PaletteItem; field: "episode" | "score" }
    | { kind: "confirm"; item: PaletteItem };

type Row = { key: string; section: string | null } & (
    | { kind: "media"; item: PaletteItem }
    | { kind: "page"; page: PageEntry }
    | { kind: "search"; query: string }
    | { kind: "command"; label: string; icon: React.ElementType; keywords: string; danger?: boolean; run: () => void }
    | { kind: "airing"; entry: PaletteAiringEntry }
    | { kind: "person"; person: PalettePerson }
    | { kind: "fact"; label: string }
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
    const [people, setPeople] = useState<PalettePerson[]>([]);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const [airing, setAiring] = useState<PaletteAiringEntry[] | null>(null);
    const [facts, setFacts] = useState<PaletteStat[] | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // The index is fetched once per session, not per open — a second ⌘K should
    // never show a spinner for a list that has not changed.
    const loadingRef = useRef(false);
    const itemsRef = useRef<PaletteItem[] | null>(null);
    itemsRef.current = items;
    const queryRef = useRef("");
    queryRef.current = query;
    const modeRef = useRef<Mode>(mode);
    modeRef.current = mode;
    // Where each level came from and what was typed to get there. A stack rather
    // than a parent-per-kind mapping because the levels genuinely nest: a show's
    // cast leads to a person, whose shows lead back to another show.
    const historyStack = useRef<{ mode: Mode; query: string }[]>([]);

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        // Deliberately not awaited together: titles are what the palette is for,
        // and holding them until the cast index lands would make every open as
        // slow as the slower of the two. The cast is also allowed to fail on its
        // own — a palette without actors is still a palette.
        void getPalettePeople()
            .then(setPeople)
            .catch(() => {});

        try {
            const fetched = await getPaletteWatchlist();
            itemsRef.current = fetched;
            setItems(fetched);
        } catch {
            setItems([]); // pages and global search still work without the index
        }
    }, []);

    /**
     * The watchlist row for the media page currently on screen, if any.
     *
     * It leads the empty list rather than replacing it: opening straight into a
     * title's actions took away the search without being asked, and the palette
     * should always start where it says it starts.
     */
    const currentItem = useMemo(() => {
        const match = pathname.match(/^\/media\/([^/]+)$/);
        if (!match || !items) return null;
        const season = searchParams.get("season");
        const wanted = season && season !== "1" ? `/media/${match[1]}?season=${season}` : `/media/${match[1]}`;
        return items.find((item) => item.href === wanted) ?? null;
    }, [items, pathname, searchParams]);

    const openPalette = useCallback(() => {
        setQuery("");
        setActive(0);
        historyStack.current = [];
        setMode({ kind: "root" });
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

    const close = useCallback(() => {
        setOpen(false);
        setMode({ kind: "root" });
        setQuery("");
        historyStack.current = [];
    }, []);

    const goTo = useCallback(
        (href: string) => {
            close();
            // Filter state on /watchlist is seeded from the query string in
            // useState initialisers, which do not re-run for a component that is
            // already mounted. So a push from /watchlist to /watchlist?status=…
            // changes the URL and nothing else. Same path plus a different query
            // is the one case that needs a real navigation; everything else stays
            // a client-side push.
            const [path, search = ""] = href.split("?");
            const samePath = path === window.location.pathname;
            const sameSearch = `?${search}` === window.location.search || (!search && !window.location.search);
            // The palette shuts before the page arrives, so without this the
            // second or two in between looks like nothing happened at all. The
            // bar starts itself on anchor clicks and never sees a router.push.
            if (!samePath || !sameSearch) startProgress();
            if (samePath && !sameSearch) window.location.assign(href);
            else router.push(href);
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
            startProgress();
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
                doneProgress();
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
        startProgress();
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
            doneProgress();
        }
    }, [close, load, router]);

    // Changing level always resets the query and the cursor: the text that found
    // a title is meaningless against a list of verbs.
    const enterMode = useCallback((next: Mode) => {
        historyStack.current.push({ mode: modeRef.current, query: queryRef.current });
        setMode(next);
        setQuery("");
        // Confirmation opens on Cancel. Two keystrokes should not be enough to
        // delete the wrong title, and the row that deletes is never the one
        // already under the cursor.
        setActive(next.kind === "confirm" ? 1 : 0);
        inputRef.current?.focus();
    }, []);

    // Both menus fetch on entry rather than on open: the schedule and the stats
    // are the two most expensive things the app computes, and most palette
    // visits never ask for either.
    const openMenu = useCallback(
        (menu: MenuId) => {
            enterMode({ kind: "menu", menu });
            if (menu === "airing" && airing === null) {
                void getAiringToday(new Date().toLocaleDateString("en-CA"))
                    .then(setAiring)
                    .catch(() => setAiring([]));
            }
            if (menu === "stats" && facts === null) {
                void getPaletteStats()
                    .then(setFacts)
                    .catch(() => setFacts([]));
            }
        },
        [enterMode, airing, facts],
    );

    // One definition, used by the root list and by help. Two lists of the same
    // commands would drift the first time one is added.
    const globalCommands = useCallback(
        (): Row[] => [
            {
                kind: "command",
                key: "menu-list",
                section: null,
                label: "My list…",
                icon: Bookmark,
                // Every status is a keyword, so typing "dropped" finds the menu
                // without the menu having to spell out one row per status.
                keywords: "show my list watchlist watching completed plan to watch on hold dropped airing filter",
                run: () => openMenu("list"),
            },
            {
                kind: "command",
                key: "menu-airing",
                section: null,
                label: "What's airing today…",
                icon: CalendarDays,
                keywords: "airing today episodes releases schedule calendar tonight new",
                run: () => openMenu("airing"),
            },
            {
                kind: "command",
                key: "menu-stats",
                section: null,
                label: "My stats…",
                icon: BarChart3,
                keywords: "stats how many hours episodes watched average rating genre completion",
                run: () => openMenu("stats"),
            },
            {
                kind: "command",
                key: "undo",
                section: null,
                label: "Undo last watched episode",
                icon: RotateCcw,
                keywords: "undo revert last watched episode mistake",
                run: () => void undo(),
            },
        ],
        [openMenu, undo],
    );

    const menuRows = useCallback(
        (menu: MenuId): Row[] => {
            if (menu === "list") {
                return [
                    ...WATCH_STATUSES.map((status) => ({
                        kind: "command" as const,
                        key: `list-${status}`,
                        section: null,
                        label: status,
                        icon: Bookmark,
                        keywords: `show my ${status} list`,
                        run: () => goTo(`/watchlist?status=${encodeURIComponent(status)}`),
                    })),
                    {
                        kind: "command" as const,
                        key: "list-airing",
                        section: null,
                        label: "Currently airing",
                        icon: CalendarDays,
                        keywords: "airing ongoing running now",
                        run: () => goTo("/watchlist?airing=1"),
                    },
                ];
            }

            if (menu === "help") return globalCommands();

            if (menu === "airing") {
                const rows: Row[] = (airing ?? []).map((entry) => ({ kind: "airing", entry, key: entry.key, section: null }));
                rows.push({
                    kind: "command",
                    key: "airing-calendar",
                    section: null,
                    label: "Open the calendar",
                    icon: CalendarDays,
                    keywords: "calendar month schedule all",
                    run: () => goTo("/calendar"),
                });
                return rows;
            }

            const rows: Row[] = (facts ?? []).map((fact) => ({ kind: "fact", label: fact.label, key: fact.key, section: null }));
            rows.push({
                kind: "command",
                key: "stats-page",
                section: null,
                label: "Open the stats page",
                icon: BarChart3,
                keywords: "stats page charts open all",
                run: () => goTo("/stats"),
            });
            return rows;
        },
        [airing, facts, goTo, globalCommands],
    );

    const castFor = useCallback(
        (item: PaletteItem): PalettePerson[] =>
            people
                .filter((person) => person.shows.some((show) => show.externalId === item.externalId))
                // Billed order, which is why the index carries the position: an
                // alphabetical cast list puts the lead wherever their name falls.
                .sort(
                    (a, b) =>
                        (a.shows.find((s) => s.externalId === item.externalId)?.order ?? 99) -
                        (b.shows.find((s) => s.externalId === item.externalId)?.order ?? 99),
                ),
        [people],
    );

    const personActions = useCallback(
        (person: PalettePerson): Row[] => {
            const rows: Row[] = [
                {
                    kind: "command",
                    key: "person-open",
                    section: null,
                    label: "Open page",
                    icon: ChevronRight,
                    keywords: "open go to page view profile",
                    run: () => goTo(`/people/${person.slug}`),
                },
            ];
            // The index query already knew these, so the answer to "what have I
            // watched with them?" is here rather than a scrape away.
            person.shows.forEach((show, i) => {
                rows.push({
                    kind: "command",
                    key: `person-show-${show.href}`,
                    // Their filmography intersected with the watchlist — which
                    // includes Plan to Watch, so "watched" would be wrong too.
                    section: i === 0 ? `${person.shows.length} ${person.shows.length === 1 ? "show" : "shows"} in your list` : null,
                    label: show.title,
                    icon: Tv,
                    keywords: show.title,
                    run: () => goTo(show.href),
                });
            });
            return rows;
        },
        [goTo],
    );

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

            const cast = castFor(item);
            if (cast.length > 0) {
                rows.push({
                    kind: "command",
                    key: "cast",
                    section: null,
                    // "Main cast", not "cast": the index holds main roles only,
                    // and offering two names out of twenty under the wider word
                    // would read as missing data rather than a deliberate cut.
                    label: `See the main cast (${cast.length})`,
                    icon: Users,
                    keywords: "cast actors people starring who is in main role",
                    run: () => enterMode({ kind: "cast", item }),
                });
            }

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
        [goTo, setProgress, enterMode, castFor],
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

        if (mode.kind === "menu") return filterByQuery(menuRows(mode.menu)).rows;

        if (mode.kind === "cast") {
            const cast = castFor(mode.item);
            const rows: Row[] = cast.map((person) => ({ kind: "person", person, key: person.slug, section: null }));
            if (trimmed.length === 0) return rows;
            return rows.filter((row) => row.kind === "person" && fuzzyScore(trimmed, row.person.name) !== null);
        }

        if (mode.kind === "person") return filterByQuery(personActions(mode.person)).rows;

        if (mode.kind === "item") return filterByQuery(itemActions(mode.item)).rows;

        if (trimmed.length === 0) {
            // Empty state is the last thing touched, which is the single most
            // likely destination — the palette opens already useful.
            // Only rows that were actually watched. The rest stay in the index
            // for searching, but padding "Recently watched" with titles added
            // and never opened would be a lie.
            const recent: Row[] = media
                .filter((item) => item.watchedAt !== null && item.id !== currentItem?.id)
                .slice(0, 5)
                .map((item) => ({ kind: "media" as const, item, key: item.id, section: null }));
            const pages: Row[] = PAGES.slice(0, MAX_PAGE_ROWS).map((page) => ({
                kind: "page" as const,
                page,
                key: page.href,
                section: null,
            }));
            const here: Row[] = currentItem ? [{ kind: "media", item: currentItem, key: currentItem.id, section: null }] : [];
            return [
                ...withSection(here, "On this page"),
                ...withSection(recent, "Recently watched"),
                ...withSection(pages, "Go to"),
            ];
        }

        const scoredMedia = media
            .map((item) => ({ item, score: fuzzyScore(trimmed, item.title) }))
            .filter((m): m is { item: PaletteItem; score: number } => m.score !== null)
            // Seasons of one show all score identically, so the tie-break puts
            // them in season order rather than in whatever order they were last
            // touched — five Breaking Bads shuffled is unreadable.
            .sort((a, b) => b.score - a.score || a.item.season - b.item.season)
            .slice(0, MAX_MEDIA_ROWS);

        const scoredPeople = people
            .map((person) => ({ person, score: fuzzyScore(trimmed, person.name) }))
            .filter((p): p is { person: PalettePerson; score: number } => p.score !== null)
            // Appearances break ties: someone in five of your shows sits above a
            // one-off with the same name score.
            .sort((a, b) => b.score - a.score || b.person.shows.length - a.person.shows.length)
            .slice(0, MAX_PEOPLE_ROWS);

        const scoredPages = PAGES.map((page) => ({ page, score: fuzzyScore(trimmed, `${page.label} ${page.keywords}`) }))
            .filter((p): p is { page: PageEntry; score: number } => p.score !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, MAX_PAGE_ROWS);

        const commands = filterByQuery([
            ...globalCommands(),
            {
                kind: "command",
                key: "menu-help",
                section: null,
                label: "Help — everything the palette can do",
                icon: CircleQuestionMark,
                keywords: "help commands list what can i do keyboard shortcuts guide",
                run: () => openMenu("help"),
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
                rows: scoredPeople.map(({ person }) => ({ kind: "person", person, key: person.slug, section: null })),
                best: scoredPeople[0]?.score ?? -Infinity,
                heading: "People",
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
    }, [query, items, people, currentItem, mode, itemActions, personActions, castFor, menuRows, openMenu, globalCommands, remove, setStatus, enterMode]);

    const clampedActive = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

    const runRow = useCallback(
        (row: Row) => {
            if (row.kind === "media") goTo(row.item.href);
            else if (row.kind === "page") goTo(row.page.href);
            else if (row.kind === "airing") goTo(row.entry.href);
            else if (row.kind === "person") goTo(`/people/${row.person.slug}`);
            else if (row.kind === "search") goTo(`/search?q=${encodeURIComponent(row.query)}`);
            else if (row.kind === "fact") goTo("/stats"); // a number is not a destination; its page is
            else row.run();
        },
        [goTo],
    );

    const back = useCallback(() => {
        const parent = historyStack.current.pop();
        if (!parent) {
            close(); // already at the top level
            return;
        }
        setMode(parent.mode);
        setQuery(parent.query);
        setActive(0);
        inputRef.current?.focus();
    }, [close]);

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
            // Tab always means forward: one level deeper where there is a level,
            // and the action itself where there is not. Enter does the same
            // thing — having two keys that both mean "yes" is worth more than
            // reserving one of them for a distinction nobody asked for.
            // → is the same key but only from an empty field, so it stays a
            // cursor key while there is text to move through.
            e.preventDefault();
            if (mode.kind === "prompt") {
                submitPrompt();
                return;
            }
            const row = rows[clampedActive];
            if (!row) return;
            if (mode.kind === "root" && row.kind === "media") enterMode({ kind: "item", item: row.item });
            else if (row.kind === "person" && (mode.kind === "root" || mode.kind === "cast"))
                enterMode({ kind: "person", person: row.person });
            else runRow(row);
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

    const scopedItem = mode.kind === "root" || mode.kind === "menu" || mode.kind === "person" ? null : mode.item;
    const inCast = mode.kind === "cast";
    const MENU_TITLES: Record<MenuId, string> = { list: "My list", airing: "Airing today", stats: "My stats", help: "Help" };
    const crumb = scopedItem ? scopedItem.title : mode.kind === "person" ? mode.person.name : mode.kind === "menu" ? MENU_TITLES[mode.menu] : null;
    const placeholder =
        mode.kind === "prompt"
            ? mode.field === "episode"
                ? `Episode number${mode.item.totalEp ? ` (1–${mode.item.totalEp})` : ""}…`
                : "Score out of 10…"
            : mode.kind === "status"
              ? "Pick a status…"
              : mode.kind === "confirm"
                ? "This cannot be undone"
                : inCast
                  ? "Filter the main cast…"
                  : mode.kind === "item" || mode.kind === "person"
                    ? "What would you like to do?"
                  : mode.kind === "menu"
                    ? "Filter this list…"
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
                    {crumb ? (
                        <button
                            onClick={back}
                            className="shrink-0 flex items-center gap-1.5 max-w-[45%] px-2 py-1 -ml-2 rounded-md bg-white/8 text-xs font-medium text-white hover:bg-white/12 transition-colors cursor-pointer"
                        >
                            <span className="truncate">{crumb}</span>
                            {scopedItem && scopedItem.season > 1 && <span className="text-gray-400">S{scopedItem.season}</span>}
                        </button>
                    ) : (
                        <Search className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        name="command-palette"
                        autoComplete="off"
                        autoFocus
                        value={query}
                        inputMode={mode.kind === "prompt" ? "decimal" : "text"}
                        onChange={(e) => {
                            // "?" is the one character that is a question rather
                            // than a search term.
                            if (e.target.value === "?" && mode.kind === "root") {
                                openMenu("help");
                                return;
                            }
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

                    {mode.kind === "menu" && mode.menu === "airing" && airing === null && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Checking today&rsquo;s schedule…</p>
                    )}
                    {mode.kind === "menu" && mode.menu === "airing" && airing?.length === 0 && (
                        <p className="px-4 pt-4 pb-2 text-center text-xs text-gray-500">Nothing from your list airs today.</p>
                    )}
                    {mode.kind === "menu" && mode.menu === "stats" && facts === null && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Counting…</p>
                    )}

                    {mode.kind === "menu" && mode.menu === "help" && (
                        <div className="px-4 pb-2 space-y-1 text-xs text-gray-500">
                            <p>
                                Type to search your watchlist. <kbd className="font-sans text-gray-400">tab</kbd> or{" "}
                                <kbd className="font-sans text-gray-400">→</kbd> opens a title&rsquo;s actions,{" "}
                                <kbd className="font-sans text-gray-400">esc</kbd> goes back a level.
                            </p>
                            <p>
                                On a title: mark the next episode, mark them all, pick a specific one, change status, rate
                                it, or remove it. Opening the palette from a title&rsquo;s own page starts there.
                            </p>
                        </div>
                    )}

                    {items !== null && rows.length === 0 && mode.kind !== "prompt" && mode.kind !== "menu" && (
                        <p className="px-4 py-6 text-center text-xs text-gray-500">Nothing matches that.</p>
                    )}

                    {rows.map((row, i) => {
                        const isActive = i === clampedActive;
                        const RowIcon = row.kind === "page" ? row.page.icon : row.kind === "command" ? row.icon : null;
                        const danger = row.kind === "command" && row.danger;
                        const hasArtwork = row.kind === "media" || row.kind === "airing" || row.kind === "person";

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
                                    className={`w-full flex items-center gap-3 px-4 text-left cursor-pointer transition-colors ${
                                        // Only the two-line rows with artwork need
                                        // the taller box; a one-line command in a
                                        // poster-sized slot is mostly air.
                                        hasArtwork ? "py-2" : "py-1.5"
                                    } ${isActive ? "bg-white/8" : "hover:bg-white/4"}`}
                                >
                                    {row.kind === "person" ? (
                                        <>
                                            <div className="shrink-0 w-7 h-10 rounded overflow-hidden bg-white/5">
                                                {row.person.image ? (
                                                    <Image
                                                        unoptimized
                                                        src={row.person.image}
                                                        alt=""
                                                        width={28}
                                                        height={40}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center">
                                                        <User className="h-3 w-3 text-gray-600" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm text-white truncate">{row.person.name}</span>
                                                <span className="block text-xs text-gray-500 truncate">
                                                    {row.person.shows.length === 1
                                                        ? "1 show in your list"
                                                        : `${row.person.shows.length} shows in your list`}
                                                </span>
                                            </span>
                                        </>
                                    ) : row.kind === "airing" ? (
                                        <>
                                            <div className="shrink-0 w-7 h-10 rounded overflow-hidden bg-white/5">
                                                {row.entry.poster ? (
                                                    <Image
                                                        unoptimized
                                                        src={row.entry.poster}
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
                                                <span className="block text-sm text-white truncate">{row.entry.title}</span>
                                                <span className="block text-xs text-gray-500 truncate">{row.entry.detail}</span>
                                            </span>
                                        </>
                                    ) : row.kind === "fact" ? (
                                        <>
                                            <span className="shrink-0 w-7 flex items-center justify-center">
                                                <BarChart3 className="h-4 w-4 text-gray-600" />
                                            </span>
                                            <span className="flex-1 min-w-0 text-sm text-gray-300 truncate">{row.label}</span>
                                        </>
                                    ) : row.kind === "media" ? (
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
                                            <span className="shrink-0 w-7 flex items-center justify-center">
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
                                                ) : row.kind === "command" ? (
                                                    row.label
                                                ) : null}
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
                    <span>
                        <kbd className="font-sans text-gray-500">tab</kbd> {mode.kind === "root" ? "actions" : "forward"}
                    </span>
                    {mode.kind !== "root" && (
                        <span>
                            <kbd className="font-sans text-gray-500">esc</kbd> back
                        </span>
                    )}
                    <button
                        onClick={() => openMenu("help")}
                        className="text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
                    >
                        <kbd className="font-sans text-gray-500">?</kbd> help
                    </button>
                    {mode.kind === "root" && items !== null && items.length > 0 && (
                        <span className="ml-auto">{items.length} titles indexed</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
