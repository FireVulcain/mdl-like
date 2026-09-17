"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
    getAiringToday,
    getPalettePeople,
    getPaletteWatchlist,
    searchPaletteRemote,
    undoLastProgress,
    type PaletteAiringEntry,
    type PaletteItem,
    type PalettePerson,
    type PaletteRemoteItem,
} from "@/actions/palette";
import { updateUserMedia, deleteUserMedia } from "@/actions/media";
import { fuzzyScore, VERBATIM_MATCH_FLOOR, ANCHORED_MATCH_FLOOR } from "@/lib/fuzzy";
import { DEFAULT_PALETTE_SHORTCUTS, matchesChord } from "@/lib/shortcuts";
import { doneProgress, startProgress } from "@/lib/progress-events";
import {
    BarChart3,
    Bookmark,
    CalendarDays,
    Clapperboard,
    CheckCheck,
    History,
    Home,
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
    { label: "Stats", href: "/stats", icon: BarChart3, keywords: "stats statistics charts activity hours episodes" },
    { label: "History", href: "/history", icon: History, keywords: "history activity log" },
    { label: "Settings", href: "/settings", icon: Settings, keywords: "settings preferences options" },
];

const WATCH_STATUSES = ["Watching", "Completed", "On Hold", "Dropped", "Plan to Watch"];

export const OPEN_PALETTE_EVENT = "trackr:open-palette";

/**
 * When the local index answers this well, nothing is asked of the network. The
 * point of searching beyond the watchlist is to find what is not in it.
 */
const LOCAL_HITS_BEFORE_REMOTE = 3;
const REMOTE_MIN_QUERY = 3;
const REMOTE_DEBOUNCE_MS = 400;

const MAX_MEDIA_ROWS = 7;
const MAX_PEOPLE_ROWS = 5;
const MAX_PAGE_ROWS = 4;
const MAX_CONTINUE_ROWS = 5;
const MAX_TONIGHT_ROWS = 3;

/**
 * Two levels and a few leaves. The palette is for finding a title in the list
 * and acting on it in three keystrokes; everything past that lives on a page.
 *
 *   root    — search everything; empty, it shows what to continue and what airs
 *   item    — one title's four actions, reached with Tab
 *   status  — pick one, for "Change status…"
 *   prompt  — a score, for "Rate…"
 *   confirm — the one destructive action asks twice
 *   help    — a page of text, reached with "?"
 */
type Mode =
    | { kind: "root" }
    | { kind: "help" }
    | { kind: "item"; item: PaletteItem }
    | { kind: "status"; item: PaletteItem }
    | { kind: "prompt"; item: PaletteItem }
    | { kind: "confirm"; item: PaletteItem };

type Row = { key: string; section: string | null } & (
    // `character` is set only when the character name is what matched, not the
    // title — it is the row explaining itself, not a field of the show.
    | { kind: "media"; item: PaletteItem; character?: string | null }
    | { kind: "page"; page: PageEntry }
    | { kind: "search"; query: string }
    | { kind: "command"; label: string; icon: React.ElementType; keywords: string; danger?: boolean; run: () => void }
    | { kind: "airing"; entry: PaletteAiringEntry }
    | { kind: "person"; person: PalettePerson }
    | { kind: "remote"; entry: PaletteRemoteItem }
);

/**
 * Best score across both spellings of a title.
 *
 * A row shows one of them and carries the other, so typing 별들에게 finds the row
 * labelled "Ask the Stars" without the label changing under the query. The
 * better of the two wins outright rather than being averaged: a title matched
 * exactly in one script is a match, whatever the other script scores.
 */
function titleScore(query: string, item: PaletteItem): number | null {
    const scores = [fuzzyScore(query, item.title), item.altTitle ? fuzzyScore(query, item.altTitle) : null].filter(
        (s): s is number => s !== null,
    );
    return scores.length > 0 ? Math.max(...scores) : null;
}

/**
 * A title match, or failing that a character one.
 *
 * People remember "the one with Hong Cha Young" more reliably than they
 * remember which of five similar titles it was, so the main cast's character
 * names are searchable too. The row still shows the title — it is the show that
 * is being offered, not the character — so when the character is what matched,
 * the row has to say so, or it looks like the palette returned something
 * unrelated.
 *
 * The title wins ties. Both are scored on the same scale, so a character
 * matched exactly still outranks a title matched loosely, which is the point:
 * an exact name is a stronger signal than a scattering of letters.
 *
 * Characters are held to a stricter test than titles, and the numbers are why.
 * Measured over the 209 shows in this index, matching them the way titles are
 * matched turned "lee" from 25 shows into 64 and "kim" from 9 into 53 — every
 * three-letter fragment of a Korean name hitting a third of the list. Nobody
 * types three letters meaning a character, so the match has to be found in one
 * piece rather than scattered across the name, and the query has to be long
 * enough to be a name. At five the noise is gone entirely — lee, kim and park
 * all back to their title-only counts — while "cha young", "su ho" and "hae in"
 * still find their shows. Six would cost "su ho" and buy nothing.
 *
 * "In one piece" means anchored, not perfect: a name typed with a letter wrong
 * still counts, which is the whole point of a search you type from memory.
 */
const CHARACTER_MIN_QUERY = 5;

function matchItem(query: string, item: PaletteItem): { score: number; character: string | null } | null {
    const title = titleScore(query, item);

    let bestCharacter: string | null = null;
    let characterBest = -Infinity;
    if (query.trim().length >= CHARACTER_MIN_QUERY) {
        for (const character of item.characters) {
            const score = fuzzyScore(query, character);
            if (score !== null && score >= ANCHORED_MATCH_FLOOR && score > characterBest) {
                characterBest = score;
                bestCharacter = character;
            }
        }
    }

    if (title === null && bestCharacter === null) return null;
    if (title !== null && title >= characterBest) return { score: title, character: null };
    return { score: characterBest, character: bestCharacter };
}

function progressLabel(item: PaletteItem): string {
    const parts: string[] = [];
    if (item.season > 1) parts.push(`S${item.season}`);
    parts.push(item.status);
    if (item.progress > 0) parts.push(item.totalEp ? `${item.progress}/${item.totalEp}` : `ep ${item.progress}`);
    if (item.year) parts.push(String(item.year));
    return parts.join(" · ");
}

/** Poster-shaped slot, the same for a show, an episode, a person or a remote hit. */
function Artwork({ src, person = false }: { src: string | null; person?: boolean }) {
    return (
        <div className="shrink-0 w-7 h-10 rounded overflow-hidden bg-surface-2">
            {src ? (
                <Image unoptimized src={src} alt="" width={28} height={40} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center">
                    {person ? <User className="h-3 w-3 text-fg-faint" /> : <Tv className="h-3 w-3 text-fg-faint" />}
                </div>
            )}
        </div>
    );
}

function Kbd({ children }: { children: React.ReactNode }) {
    return <kbd className="font-sans text-fg-dim">{children}</kbd>;
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
    const [airing, setAiring] = useState<PaletteAiringEntry[]>([]);
    const [active, setActive] = useState(0);
    const [busy, setBusy] = useState(false);
    const [remote, setRemote] = useState<{ query: string; items: PaletteRemoteItem[] } | null>(null);
    const [searchingRemote, setSearchingRemote] = useState(false);
    const remoteCache = useRef(new Map<string, PaletteRemoteItem[]>());

    const listRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    // The index is fetched once per session, not per open — a second ⌘K should
    // never show a skeleton for a list that has not changed.
    const loadingRef = useRef(false);
    const queryRef = useRef("");
    queryRef.current = query;
    const modeRef = useRef<Mode>(mode);
    modeRef.current = mode;
    // Where each level came from and what was typed to get there, so backing
    // out of "Change status…" lands on the title's actions with the query intact.
    const historyStack = useRef<{ mode: Mode; query: string }[]>([]);

    const load = useCallback(async () => {
        if (loadingRef.current) return;
        loadingRef.current = true;
        // Deliberately not awaited together: titles are what the palette is for,
        // and holding them until the others land would make every open as slow
        // as the slowest of the three. Each is allowed to fail on its own — a
        // palette without actors or tonight's episodes is still a palette.
        void getPalettePeople()
            .then(setPeople)
            .catch(() => {});
        void getAiringToday(new Date().toLocaleDateString("en-CA"))
            .then(setAiring)
            .catch(() => {});

        try {
            setItems(await getPaletteWatchlist());
        } catch {
            setItems([]); // pages and global search still work without the index
        }
    }, []);

    // Fetched once the page has settled, not on the first ⌘K: the index is a
    // few DB reads, and pulling it during idle time means the palette almost
    // always opens on the real list rather than a placeholder for it.
    useEffect(() => {
        // Safari has no requestIdleCallback; a short delay does the same job.
        // Typed as always present, hence the runtime check on the function itself.
        if (typeof window.requestIdleCallback === "function") {
            const id = window.requestIdleCallback(() => void load(), { timeout: 2000 });
            return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(() => void load(), 500);
        return () => window.clearTimeout(id);
    }, [load]);

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

    // Closing only closes. The reset belongs to opening, and openPalette already
    // does it — every way in goes through there, since onOpenChange below only
    // ever handles the closing direction.
    //
    // Clearing here meant the emptied root menu rendered *inside* the dialog
    // while it was still on screen: DialogContent animates out over 200ms, so
    // pressing Enter on a result replaced it with the empty state and let that
    // fade away instead of the thing that had just been chosen.
    const close = useCallback(() => {
        setOpen(false);
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
                { progress: episode, watchedAt: new Date().toISOString() },
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

    /**
     * Everything the palette does that is not a title or a page, as one flat
     * list. It used to hide behind "My list…" and "What's airing…" submenus;
     * flat, "dropped" finds the Dropped filter directly and nothing needs a
     * second Enter.
     */
    const globalCommands = useCallback(
        (): Row[] => [
            ...WATCH_STATUSES.map(
                (status): Row => ({
                    kind: "command",
                    key: `list-${status}`,
                    section: null,
                    label: `Watchlist · ${status}`,
                    icon: Bookmark,
                    keywords: `show my list filter ${status}`,
                    run: () => goTo(`/watchlist?status=${encodeURIComponent(status)}`),
                }),
            ),
            {
                kind: "command",
                key: "list-airing",
                section: null,
                label: "Watchlist · Currently airing",
                icon: CalendarDays,
                keywords: "show my list filter airing ongoing running now",
                run: () => goTo("/watchlist?airing=1"),
            },
            {
                kind: "command",
                key: "together",
                section: null,
                label: "Worked with…",
                icon: Users,
                keywords: "worked with together co-star costar shared credits compare two people pair actors",
                run: () => goTo("/people/together"),
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
        [goTo, undo],
    );

    /**
     * Four actions, and the input as the fifth. Typing a number here means an
     * episode — "7" offers "Mark episode 7 watched", the last number offers the
     * whole run — so neither "a specific episode…" nor "mark all…" needs a row
     * of its own to be found under.
     */
    const itemActions = useCallback(
        (item: PaletteItem, typed: string): Row[] => {
            const next = item.progress + 1;
            const remaining = item.totalEp ? item.totalEp - item.progress : null;

            const wanted = typed === "all" && item.totalEp ? item.totalEp : /^\d+$/.test(typed) ? Number(typed) : null;
            if (wanted !== null) {
                if (item.totalEp && wanted > item.totalEp) {
                    return [];
                }
                const whole = item.totalEp !== null && wanted === item.totalEp && wanted > 1;
                return [
                    {
                        kind: "command",
                        key: `ep-${wanted}`,
                        section: null,
                        label: whole ? `Mark all ${item.totalEp} episodes watched` : `Mark episode ${wanted} watched`,
                        icon: whole ? CheckCheck : Play,
                        keywords: "",
                        run: () => setProgress(item, wanted),
                    },
                ];
            }

            const rows: Row[] = [];
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
            rows.push(
                {
                    kind: "command",
                    key: "rate",
                    section: null,
                    label: "Rate…",
                    icon: Star,
                    keywords: "rate rating score",
                    run: () => enterMode({ kind: "prompt", item }),
                },
                {
                    kind: "command",
                    key: "status",
                    section: null,
                    label: "Change status…",
                    icon: Bookmark,
                    keywords: "status watching completed dropped hold plan move",
                    run: () => enterMode({ kind: "status", item }),
                },
                {
                    kind: "command",
                    key: "remove",
                    section: null,
                    label: "Remove from my list",
                    icon: Trash2,
                    keywords: "remove delete drop off list",
                    danger: true,
                    run: () => enterMode({ kind: "confirm", item }),
                },
            );
            return rows;
        },
        [setProgress, enterMode],
    );

    // How well the local index is doing, which is the deciding gate below.
    const local = useMemo(() => {
        const trimmed = query.trim();
        if (trimmed.length === 0 || !items) return { hits: 0, best: -Infinity };
        let hits = 0;
        let best = -Infinity;
        for (const item of items) {
            const match = matchItem(trimmed, item);
            if (!match) continue;
            hits++;
            if (match.score > best) best = match.score;
        }
        return { hits, best };
    }, [query, items]);

    // The one place the palette reaches past what it already holds.
    //
    // Four gates, and all four have to open: the root level, three characters,
    // a pause in typing, and a local index that came up short. Firing on every
    // keystroke would put a request on the scraper per letter, and most of them
    // would be answering a question already answered from memory.
    useEffect(() => {
        const trimmed = query.trim();
        if (mode.kind !== "root" || trimmed.length < REMOTE_MIN_QUERY) return;
        // Enough local answers, or one that matches the text exactly — typing the
        // name of a show you already track should not cost a request. The
        // "Search everywhere" row is still there when the intent was elsewhere.
        if (local.hits >= LOCAL_HITS_BEFORE_REMOTE || local.best >= VERBATIM_MATCH_FLOOR) return;

        const timer = setTimeout(async () => {
            const cached = remoteCache.current.get(trimmed);
            if (cached) {
                setRemote({ query: trimmed, items: cached });
                return;
            }
            setSearchingRemote(true);
            try {
                const found = await searchPaletteRemote(trimmed);
                remoteCache.current.set(trimmed, found);
                // Typing carried on while this was in flight: the answer belongs
                // to a question no longer being asked.
                if (queryRef.current.trim() === trimmed) setRemote({ query: trimmed, items: found });
            } catch {
                // The local results stand on their own
            } finally {
                setSearchingRemote(false);
            }
        }, REMOTE_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [query, mode.kind, local]);

    const rows = useMemo<Row[]>(() => {
        const trimmed = query.trim();
        const media = items ?? [];

        const withSection = (group: Row[], heading: string) =>
            group.map((row, i) => ({ ...row, section: i === 0 ? heading : null }));

        // Returns the surviving rows plus the group's best score, so groups can
        // be ranked against each other rather than sitting in a fixed order.
        const filterCommands = (group: Row[]): { rows: Row[]; best: number } => {
            if (trimmed.length === 0) return { rows: group, best: 0 };
            const scored = group
                .map((row) => ({ row, score: row.kind === "command" ? fuzzyScore(trimmed, `${row.label} ${row.keywords}`) : 0 }))
                .filter((r): r is { row: Row; score: number } => r.score !== null)
                .sort((a, b) => b.score - a.score);
            return { rows: scored.map((r) => r.row), best: scored[0]?.score ?? -Infinity };
        };

        const airingRows = (entries: PaletteAiringEntry[]): Row[] =>
            entries.map((entry) => ({ kind: "airing", entry, key: entry.key, section: null }));

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
                    run: () => back(),
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

        if (mode.kind === "prompt" || mode.kind === "help") return []; // the input, or the text, is the whole interface

        if (mode.kind === "item") {
            const actions = itemActions(mode.item, trimmed.toLowerCase());
            // A number was typed: the one row it produced is the answer, and
            // fuzzy-matching "7" against "Mark episode 7 watched" is beside the point.
            if (actions.length === 1 && actions[0].kind === "command" && actions[0].keywords === "") return actions;
            return filterCommands(actions).rows;
        }

        if (trimmed.length === 0) {
            // The empty state is the palette's argument for existing: what you
            // were in the middle of, one Tab from the next episode, and what airs
            // tonight. Pages are a click away in the header and are found by
            // typing; listing them here said nothing.
            const here: Row[] = currentItem ? [{ kind: "media", item: currentItem, key: currentItem.id, section: null }] : [];
            const watching: Row[] = media
                .filter((item) => item.status === "Watching" && item.id !== currentItem?.id)
                // Last touched first; never touched last, in whatever order they came
                .sort((a, b) => (b.watchedAt ?? "").localeCompare(a.watchedAt ?? ""))
                .slice(0, MAX_CONTINUE_ROWS)
                .map((item) => ({ kind: "media" as const, item, key: item.id, section: null }));
            const undoRow = globalCommands().filter((row) => row.key === "undo");
            return [
                ...withSection(here, "On this page"),
                ...withSection(watching, "Continue watching"),
                ...withSection(airingRows(airing.slice(0, MAX_TONIGHT_ROWS)), "Tonight"),
                ...withSection(undoRow, "Commands"),
            ];
        }

        const scoredMedia = media
            .map((item) => ({ item, ...(matchItem(trimmed, item) ?? { score: null, character: null }) }))
            .filter((m): m is { item: PaletteItem; score: number; character: string | null } => m.score !== null)
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

        // Tonight's episodes answer to the word as well as to their titles:
        // "tonight" or "airing" brings the whole evening, a show's name brings
        // its episode.
        const wholeEvening = fuzzyScore(trimmed, "airing tonight today episodes");
        const scoredAiring = airing
            .map((entry) => ({ entry, score: wholeEvening ?? fuzzyScore(trimmed, entry.title) }))
            .filter((a): a is { entry: PaletteAiringEntry; score: number } => a.score !== null)
            .sort((a, b) => b.score - a.score);

        const commands = filterCommands(globalCommands());

        // Every group is ranked by its own best match, so whichever one holds
        // the strongest hit leads. Typing "stats" must not bury the Stats page
        // under six titles that merely contain s, t, a, t, s in that order, and
        // typing "undo" must not bury the Undo command under "Undercover".
        const groups: { rows: Row[]; best: number; heading: string }[] = [
            {
                rows: scoredMedia.map(({ item, character }) => ({
                    kind: "media" as const,
                    item,
                    character,
                    key: item.id,
                    section: null,
                })),
                best: scoredMedia[0]?.score ?? -Infinity,
                heading: "Your watchlist",
            },
            {
                rows: scoredPeople.map(({ person }) => ({ kind: "person", person, key: person.slug, section: null })),
                best: scoredPeople[0]?.score ?? -Infinity,
                heading: "People",
            },
            {
                rows: airingRows(scoredAiring.map((a) => a.entry)),
                best: scoredAiring[0]?.score ?? -Infinity,
                heading: "Tonight",
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

        // Always last, never ranked against the rest: what you already track
        // outranks what you do not, whatever the scores say. Only shown for the
        // query it was fetched for, so a stale answer never sits under new text.
        //
        // The remote search does not know the list, so a tracked show comes back
        // in its results too — "Not in your list" then contradicted the row just
        // above it. Matched on the page path: a season's href carries a query
        // string, the remote hit never does.
        const tracked = new Set(media.map((item) => item.href.split("?")[0]));
        const remoteRows: Row[] =
            remote?.query === trimmed
                ? remote.items
                      .filter((entry) => !tracked.has(entry.href))
                      .map((entry) => ({ kind: "remote" as const, entry, key: `remote-${entry.key}`, section: null }))
                : [];

        return [
            ...ordered,
            ...withSection(remoteRows, "Not in your list"),
            { kind: "search", query: trimmed, key: "search", section: null },
        ];
    }, [query, items, people, airing, currentItem, remote, mode, itemActions, globalCommands, remove, setStatus, back]);

    const clampedActive = rows.length === 0 ? 0 : Math.min(active, rows.length - 1);

    const runRow = useCallback(
        (row: Row) => {
            if (row.kind === "media") goTo(row.item.href);
            else if (row.kind === "page") goTo(row.page.href);
            else if (row.kind === "airing") goTo(row.entry.href);
            else if (row.kind === "remote") goTo(row.entry.href);
            else if (row.kind === "person") goTo(`/people/${row.person.slug}`);
            else if (row.kind === "search") goTo(`/search?q=${encodeURIComponent(row.query)}`);
            else row.run();
        },
        [goTo],
    );

    const submitScore = () => {
        if (mode.kind !== "prompt") return;
        const value = Number(query.trim().replace(",", "."));
        if (!Number.isFinite(value) || value < 0 || value > 10) return;
        setScore(mode.item, value);
    };

    // Three keys, three meanings, the same at every level: Enter does the row,
    // Tab goes into a title's actions, Escape comes back out. Backspace on an
    // empty field is Escape by another name, which is what every other palette
    // taught people to expect.
    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i + 1) % rows.length));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (rows.length === 0 ? 0 : (i - 1 + rows.length) % rows.length));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (mode.kind === "prompt") submitScore();
            else {
                const row = rows[clampedActive];
                if (row) runRow(row);
            }
        } else if (e.key === "Tab") {
            e.preventDefault();
            const row = rows[clampedActive];
            if (mode.kind === "root" && row?.kind === "media") enterMode({ kind: "item", item: row.item });
        } else if (e.key === "Backspace" && query.length === 0 && mode.kind !== "root") {
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

    const scopedItem = mode.kind === "root" || mode.kind === "help" ? null : mode.item;
    const crumb = scopedItem ? scopedItem.title : mode.kind === "help" ? "Help" : null;
    const placeholder =
        mode.kind === "prompt"
            ? "Score out of 10…"
            : mode.kind === "status"
              ? "Pick a status…"
              : mode.kind === "confirm"
                ? "This cannot be undone"
                : mode.kind === "item"
                  ? "Pick an action, or type an episode number…"
                  : mode.kind === "help"
                    ? ""
                    : "Search your watchlist, or jump to a page…";

    const loading = items === null && mode.kind === "root" && query.trim().length === 0;

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
                className="top-[12%] translate-y-0 p-0 gap-0 sm:max-w-xl bg-panel border-line-strong overflow-hidden"
            >
                <DialogTitle className="sr-only">Command palette</DialogTitle>

                <div className="flex items-center gap-2 px-4 h-12 border-b border-line">
                    {crumb ? (
                        <button
                            onClick={back}
                            className="shrink-0 flex items-center gap-1.5 max-w-[45%] px-2 py-1 -ml-2 rounded-md bg-surface-3 text-xs font-medium text-fg hover:bg-surface-4 transition-colors cursor-pointer"
                        >
                            <span className="truncate">{crumb}</span>
                            {scopedItem && scopedItem.season > 1 && <span className="text-fg-muted">S{scopedItem.season}</span>}
                        </button>
                    ) : (
                        <Search className="h-4 w-4 text-fg-dim shrink-0" />
                    )}
                    <input
                        ref={inputRef}
                        name="command-palette"
                        autoComplete="off"
                        autoFocus
                        value={query}
                        inputMode={mode.kind === "prompt" || mode.kind === "item" ? "decimal" : "text"}
                        onChange={(e) => {
                            // "?" is the one character that is a question rather
                            // than a search term.
                            if (e.target.value === "?" && mode.kind === "root") {
                                enterMode({ kind: "help" });
                                return;
                            }
                            setQuery(e.target.value);
                            setActive(0);
                        }}
                        onKeyDown={onInputKeyDown}
                        placeholder={placeholder}
                        aria-label={placeholder || "Help"}
                        className="flex-1 min-w-0 bg-transparent text-sm text-fg placeholder:text-fg-dim outline-none"
                    />
                    {(busy || searchingRemote) && (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-line-strong border-t-white/70 animate-spin shrink-0" />
                    )}
                </div>

                <div ref={listRef} className="max-h-[min(60vh,26rem)] overflow-y-auto py-2">
                    {loading && (
                        // The shape of the rows about to land — same heading, same
                        // poster slot, same two lines — so their arrival changes
                        // the pixels and not the layout.
                        <div aria-hidden>
                            <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
                                Continue watching
                            </p>
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-2">
                                    <div className="shrink-0 w-7 h-10 rounded bg-surface-2 animate-pulse" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 rounded bg-surface-2 animate-pulse" style={{ width: `${[56, 40, 48, 64, 36][i]}%` }} />
                                        <div className="h-2.5 w-28 rounded bg-surface-2/70 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {mode.kind === "prompt" && (
                        <p className="px-4 py-6 text-center text-xs text-fg-dim">
                            Type a score from 1 to 10 — decimals allowed — and press Enter.
                        </p>
                    )}

                    {mode.kind === "help" && (
                        <div className="px-4 py-2 space-y-3 text-xs text-fg-dim">
                            <p>
                                Type to search your watchlist by title, native title or a main character&rsquo;s name. People,
                                pages and commands turn up alongside; what you don&rsquo;t track yet is looked up further down.
                            </p>
                            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                                <Kbd>↵</Kbd>
                                <span>open the highlighted row</span>
                                <Kbd>tab</Kbd>
                                <span>a title&rsquo;s actions: next episode, rate, status, remove</span>
                                <Kbd>esc</Kbd>
                                <span>back a level, then close</span>
                            </div>
                            <p>
                                Inside a title, typing a number marks that episode; the last number marks them all. Opening
                                the palette from a title&rsquo;s own page puts that title first.
                            </p>
                            <p>
                                Commands worth knowing: <span className="text-fg-muted">undo</span> takes back the last episode,{" "}
                                <span className="text-fg-muted">dropped</span> or any status filters the watchlist,{" "}
                                <span className="text-fg-muted">tonight</span> lists today&rsquo;s episodes.
                            </p>
                        </div>
                    )}

                    {mode.kind === "item" && rows.length === 0 && (
                        <p className="px-4 py-6 text-center text-xs text-fg-dim">
                            {mode.item.totalEp ? `This one has ${mode.item.totalEp} episodes.` : "Nothing matches that."}
                        </p>
                    )}

                    {!loading && rows.length === 0 && mode.kind !== "prompt" && mode.kind !== "help" && mode.kind !== "item" && (
                        <p className="px-4 py-6 text-center text-xs text-fg-dim">
                            {mode.kind === "root" && query.trim().length === 0
                                ? "Nothing in progress. Search your watchlist, or jump to a page."
                                : "Nothing matches that."}
                        </p>
                    )}

                    {rows.map((row, i) => {
                        const isActive = i === clampedActive;
                        const danger = row.kind === "command" && row.danger;
                        const hasArtwork =
                            row.kind === "media" || row.kind === "airing" || row.kind === "person" || row.kind === "remote";
                        const Icon = row.kind === "page" ? row.page.icon : row.kind === "command" ? row.icon : Search;

                        return (
                            <div key={row.key}>
                                {row.section && (
                                    <p className="px-4 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
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
                                    } ${isActive ? "bg-surface-3" : "hover:bg-surface-2"}`}
                                >
                                    {row.kind === "media" ? (
                                        <>
                                            <Artwork src={row.item.poster} />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm text-fg truncate">{row.item.title}</span>
                                                <span className="block text-xs text-fg-dim truncate">
                                                    {/* Why this row is here, when the title
                                                        is not what was typed. */}
                                                    {row.character && <span className="text-sky-400">{row.character} · </span>}
                                                    {progressLabel(row.item)}
                                                </span>
                                            </span>
                                        </>
                                    ) : row.kind === "airing" || row.kind === "remote" ? (
                                        <>
                                            <Artwork
                                                src={row.kind === "airing" ? row.entry.poster : row.entry.image}
                                                person={row.kind === "remote" && row.entry.kind === "person"}
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm text-fg truncate">{row.entry.title}</span>
                                                <span className="block text-xs text-fg-dim truncate">{row.entry.detail}</span>
                                            </span>
                                        </>
                                    ) : row.kind === "person" ? (
                                        <>
                                            <Artwork src={row.person.image} person />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-sm text-fg truncate">{row.person.name}</span>
                                                <span className="block text-xs text-fg-dim truncate">
                                                    {row.person.shows.length === 1
                                                        ? "1 show in your list"
                                                        : `${row.person.shows.length} shows in your list`}
                                                </span>
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="shrink-0 w-7 flex items-center justify-center">
                                                <Icon className={`h-4 w-4 ${danger ? "text-rose-400/80" : "text-fg-dim"}`} />
                                            </span>
                                            <span className={`flex-1 min-w-0 text-sm truncate ${danger ? "text-rose-300" : "text-fg"}`}>
                                                {row.kind === "search" ? (
                                                    <>
                                                        <span className="text-fg-muted">Search everywhere for </span>
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

                                    {/* The keys, on the row they apply to. A title at
                                        the root has two, and the second is the one
                                        nobody finds unless it is written down. */}
                                    {isActive && (
                                        <span className="shrink-0 flex items-center gap-2.5 text-[11px] text-fg-faint">
                                            <span>
                                                <Kbd>↵</Kbd> {mode.kind === "root" ? "open" : "run"}
                                            </span>
                                            {mode.kind === "root" && row.kind === "media" && (
                                                <span>
                                                    <Kbd>tab</Kbd> actions
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-4 px-4 h-9 border-t border-line text-[11px] text-fg-faint">
                    <span>
                        <Kbd>↑↓</Kbd> navigate
                    </span>
                    {mode.kind === "root" ? (
                        <>
                            <span>
                                <Kbd>↵</Kbd> open
                            </span>
                            <span>
                                <Kbd>tab</Kbd> actions
                            </span>
                            <button
                                onClick={() => enterMode({ kind: "help" })}
                                className="text-fg-faint hover:text-fg-soft transition-colors cursor-pointer"
                            >
                                <Kbd>?</Kbd> help
                            </button>
                        </>
                    ) : (
                        <>
                            {mode.kind !== "help" && (
                                <span>
                                    <Kbd>↵</Kbd> run
                                </span>
                            )}
                            <span>
                                <Kbd>esc</Kbd> back
                            </span>
                        </>
                    )}
                    {mode.kind === "root" && items !== null && items.length > 0 && (
                        <span className="ml-auto">{items.length} titles indexed</span>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
