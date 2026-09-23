"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Copy, Loader2, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    doorGoverns,
    isEvent,
    linkListed,
    LINK_TYPES,
    type CharacterMapData,
    type LinkType,
    type MapLink,
    type MapPerson,
} from "@/lib/character-map";
import { draftFrom, emptyDraft, fingerprint, linkFrom, type LinkDraft } from "@/lib/character-map-links";
import { deleteRelationship, saveRelationship } from "@/actions/character-map-links";
import { Face, LegendToggle, LegendType, TieMark } from "./character-map-bits";
import { RelationshipEditor, type EditorMode } from "./relationship-editor";

/**
 * Every relationship of one chart, as a list that can be read and — for the
 * admin — written.
 *
 * It sits under the chart on the drama's own relationships page, so the
 * picture and the list it is drawn from are never more than a scroll apart:
 * a link saved here lands in the chart above on the same click. Anyone who
 * can see the chart can read this list; the editing controls are the admin's,
 * and `saveRelationship` / `deleteRelationship` check that again on the
 * server — the hidden button is not the guard.
 *
 * The reveals are behind the page's one spoiler door, held by the workspace
 * and shared with the chart: shut unless the reader has finished the show,
 * and opening either "Reveals" pill opens both. A twist is a line of plain
 * text here — it must not be the one place on the page that gives it away,
 * and that holds for the admin reading their own site as much as for anyone
 * else.
 *
 * The place in the story is shared the same way, and so is the rule that
 * follows from it (`doorGoverns`, in the lib): as of an episode, a dated
 * twist is the slider's — it has happened or not — and only the undated
 * ones answer to the door. The list showing "10 behind the reveals" under a
 * chart saying "Reveals 0" was the two halves reading two rules.
 */

type Row = { link: MapLink; index: number };

function episodeText(l: MapLink): string | null {
    if (l.since == null && l.until == null) return null;
    if (isEvent(l)) return `Ep ${l.since}`;
    if (l.until == null) return `Ep ${l.since}+`;
    if (l.since == null) return `to ep ${l.until}`;
    return l.since === l.until ? `Ep ${l.since}` : `Ep ${l.since}–${l.until}`;
}

export function RelationshipManager({
    map,
    mdlSlug,
    mediaId,
    canEdit,
    reveals,
    onReveals,
    stops,
    stop,
    onStop,
    onMap,
    highlight = null,
    editRequest = null,
    onAddPerson,
}: {
    map: CharacterMapData;
    mdlSlug: string;
    mediaId: string;
    canEdit: boolean;
    /** the page's spoiler door, shared with the chart above */
    reveals: boolean;
    onReveals: (next: boolean) => void;
    /** the page's place in the story, shared the same way: the slider's stops, and which one */
    stops: [number, number][];
    stop: number;
    onStop: (next: number) => void;
    onMap: (next: CharacterMapData) => void;
    /** the link picked in the chart above: its row is marked, so it is found without reading the list */
    highlight?: number | null;
    /** the chart's "Edit in the list": scroll to that row, out from under the filters if need be, and open it */
    editRequest?: { index: number; at: number } | null;
    /** opens the character editor, for someone MDL's cast does not carry; the admin's only */
    onAddPerson?: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    // The kinds switched off in the legend; none, and every kind shows
    const [hidden, setHidden] = useState<Set<LinkType>>(new Set());
    // Ties or moments, or both (the default). Moments are listed in the
    // story's order — that is what a list of them is for.
    const [kind, setKind] = useState<"all" | "tie" | "event">("all");
    const [editing, setEditing] = useState<{ mode: EditorMode; index: number | null; expect: string | null; original: MapLink | null; draft: LinkDraft } | null>(null);
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);
    // The pairs opened by hand. Folded, a card is one line — who, and where
    // they stand now — so the list reads as its cast before its detail.
    const [opened, setOpened] = useState<Set<string>>(new Set());
    const pairKey = (l: MapLink) => [l.from, l.to].sort().join("|");
    const togglePair = (key: string) =>
        setOpened((prev) => {
            const next = new Set(prev);
            if (!next.delete(key)) next.add(key);
            return next;
        });
    const openPair = (key: string) => setOpened((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    // A link picked in the chart is found in the list: its pair opens
    useEffect(() => {
        const link = highlight == null ? null : map.links[highlight];
        if (link) openPair(pairKey(link));
    }, [highlight, map]);

    const byId = useMemo(() => new Map(map.people.map((p) => [p.id, p])), [map]);
    const name = (id: string) => byId.get(id)?.name ?? id;

    // As of the page's place in the story, by the chart's own rule: a dated
    // chart is always read as of a stop, an undated one has none. The list
    // keeps what has begun by the stop, ended or not — a tie that ended is
    // still part of the story a reader at that stop knows.
    const byEpisode = stops.length > 0;
    const stopIdx = Math.min(stop, Math.max(0, stops.length - 1));
    const episode = stops[stopIdx]?.[1] ?? 0;
    const happened = useMemo<Row[]>(() => map.links.map((link, index) => ({ link, index })).filter(({ link }) => linkListed(link, byEpisode, episode)), [map, byEpisode, episode]);
    const all = useMemo<Row[]>(() => happened.filter(({ link }) => reveals || !doorGoverns(link, byEpisode)), [happened, reveals, byEpisode]);
    const revealCount = useMemo(() => happened.filter(({ link }) => doorGoverns(link, byEpisode)).length, [happened, byEpisode]);

    const rows = useMemo<Row[]>(() => {
        const q = query.trim().toLowerCase();
        const kept = all
            .filter(({ link }) => {
                if (kind !== "all" && (kind === "event") !== isEvent(link)) return false;
                if (hidden.has(link.type)) return false;
                if (!q) return true;
                const people = [byId.get(link.from), byId.get(link.to)].filter(Boolean) as MapPerson[];
                const hay = [link.label, link.short, link.evidence, link.source, ...people.flatMap((p) => [p.name, p.actor])];
                return hay.some((s) => s?.toLowerCase().includes(q));
            });
        return kind === "event" ? [...kept].sort((a, b) => (a.link.since ?? 0) - (b.link.since ?? 0)) : kept;
    }, [all, byId, query, hidden, kind]);

    const filtering = !!query.trim() || hidden.size > 0 || kind !== "all";
    const momentCount = useMemo(() => all.filter(({ link }) => isEvent(link)).length, [all]);
    const counts = useMemo(() => Object.fromEntries(LINK_TYPES.map((t) => [t, all.filter(({ link }) => link.type === t).length])) as Record<LinkType, number>, [all]);

    // The rows by pair of people, leads first
    const leads = useMemo(() => new Set(map.compact.center ?? map.main.slice(0, 2)), [map]);
    const pairs = useMemo(() => {
        const groups = new Map<string, Row[]>();
        for (const row of rows) {
            const key = [row.link.from, row.link.to].sort().join("|");
            groups.set(key, [...(groups.get(key) ?? []), row]);
        }
        const leadsIn = (key: string) => key.split("|").filter((id) => leads.has(id)).length;
        return [...groups.entries()]
            .sort(([ka, ra], [kb, rb]) => leadsIn(kb) - leadsIn(ka) || rb.length - ra.length || ra[0].index - rb[0].index)
            .map(([key, pairRows]) => {
                // a lead named first
                const [a, b] = key.split("|").sort((x, y) => Number(leads.has(y)) - Number(leads.has(x)));
                // the story's order: by episode, a tie before a moment of the same one
                const ordered = [...pairRows].sort((x, y) => (x.link.since ?? 0) - (y.link.since ?? 0) || Number(isEvent(x.link)) - Number(isEvent(y.link)) || x.index - y.index);
                return { key, a, b, rows: ordered };
            });
    }, [rows, leads]);

    const toggleType = (t: LinkType) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (!next.delete(t)) next.add(t);
            return next;
        });

    const clearFilters = () => {
        setQuery("");
        setHidden(new Set());
        setKind("all");
    };

    // The chart asked for a row: filters that hide it are cleared, the
    // reveals opened if it sits behind them, then the row is scrolled to —
    // on the next frame, once it exists — and opened when the scroll lands,
    // so the reader sees the page travel to the row before the editor
    // covers it. `scrollend` says when; browsers without it get a timer.
    useEffect(() => {
        if (!editRequest) return;
        const { index } = editRequest;
        const link = map.links[index];
        if (!link) return;
        if (!rows.some((r) => r.index === index)) clearFilters();
        openPair(pairKey(link));
        if (!reveals && doorGoverns(link, byEpisode)) onReveals(true);
        let timer = 0;
        let done = false;
        const open = () => {
            if (done) return;
            done = true;
            window.removeEventListener("scrollend", open);
            window.clearTimeout(timer);
            if (canEdit) openEdit(index);
        };
        const frame = requestAnimationFrame(() => {
            const row = document.getElementById(`relationship-${index}`);
            if (!row) return open();
            const { top, bottom } = row.getBoundingClientRect();
            // already in view: nothing scrolls, so nothing ends
            if (top >= 0 && bottom <= window.innerHeight) return open();
            window.addEventListener("scrollend", open, { once: true });
            timer = window.setTimeout(open, 900);
            row.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scrollend", open);
            window.clearTimeout(timer);
        };
        // only a new request should run this, not every render the filters change
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editRequest]);

    /* ------------------------------------------------------------ writing */

    const openCreate = () => {
        setEditorError(null);
        setEditing({ mode: "create", index: null, expect: null, original: null, draft: emptyDraft(map) });
    };
    const openEdit = (index: number) => {
        const link = map.links[index];
        if (!link) return;
        setEditorError(null);
        setEditing({ mode: "edit", index, expect: fingerprint(link), original: link, draft: draftFrom(link) });
    };
    const openDuplicate = (index: number) => {
        const link = map.links[index];
        if (!link) return;
        setEditorError(null);
        // A copy is a new link that keeps everything but its place in the
        // list — the quickest way to write the same tie at another episode.
        setEditing({ mode: "duplicate", index: null, expect: null, original: link, draft: draftFrom(link) });
    };

    const save = async (draft: LinkDraft) => {
        if (!editing) return;
        setSaving(true);
        setEditorError(null);
        try {
            const link = linkFrom(draft, editing.original);
            const res = await saveRelationship({ mdlSlug, mediaId, index: editing.index, expect: editing.expect, link });
            if (!res.ok) {
                setEditorError(res.error);
                return;
            }
            onMap(res.map);
            setEditing(null);
            router.refresh();
        } catch {
            setEditorError("The save did not go through.");
        } finally {
            setSaving(false);
        }
    };

    const remove = async (index: number) => {
        const link = map.links[index];
        if (!link) return;
        setBusy(index);
        setListError(null);
        setConfirming(null);
        try {
            const res = await deleteRelationship({ mdlSlug, mediaId, index, expect: fingerprint(link) });
            if (!res.ok) {
                setListError(res.error);
                return;
            }
            onMap(res.map);
            router.refresh();
        } catch {
            setListError("The delete did not go through.");
        } finally {
            setBusy(null);
        }
    };

    /* --------------------------------------------------------------- view */

    const iconBtn =
        "inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-dim opacity-0 transition-all hover:bg-surface-3 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40 cursor-pointer";

    // A search opens every pair it finds: the matches are what was asked for
    const searching = !!query.trim();
    const allOpen = pairs.length > 0 && pairs.every((pr) => opened.has(pr.key));

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-lg font-semibold text-fg">All relationships</h2>
                    <p className="text-sm text-fg-muted">
                        {all.length - momentCount} tie{all.length - momentCount === 1 ? "" : "s"}
                        {momentCount > 0 && <span> · {momentCount} moment{momentCount === 1 ? "" : "s"}</span>}
                        {filtering && <span className="text-fg-dim"> · {rows.length} shown</span>}
                        {pairs.length > 1 && (
                            <>
                                <span className="text-fg-dim"> · </span>
                                <button
                                    type="button"
                                    onClick={() => setOpened(allOpen ? new Set() : new Set(pairs.map((pr) => pr.key)))}
                                    className="text-fg-dim underline-offset-2 transition-colors hover:text-fg hover:underline cursor-pointer"
                                >
                                    {allOpen ? "Collapse all" : "Expand all"}
                                </button>
                            </>
                        )}
                        {!reveals && revealCount > 0 && <span className="text-fg-dim"> · {revealCount} behind the reveals</span>}
                    </p>
                </div>
                {canEdit && (
                    // The admin's tools, not the page's call to action: text, in the
                    // site's link colour so it reads as something to click, instead
                    // of a bright filled button shouting over a page most people
                    // only read
                    <div className="flex items-center gap-4">
                        {onAddPerson && (
                            <button
                                type="button"
                                onClick={onAddPerson}
                                className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-sky-400 underline-offset-4 transition-colors hover:text-sky-300 hover:underline cursor-pointer"
                            >
                                <UserPlus className="h-3.5 w-3.5" />
                                Character
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={openCreate}
                            className="inline-flex h-8 items-center gap-1 text-[13px] font-medium text-sky-400 underline-offset-4 transition-colors hover:text-sky-300 hover:underline cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Relationship
                        </button>
                    </div>
                )}
            </div>

            {/* Filters: the questions asked of a list like this — who, what
                kind, when. The kinds are the chart's legend, the same entries
                that filter the chart above, so the page speaks one language. */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="relative min-w-[12rem] flex-1 sm:max-w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, label, evidence…"
                        className="h-7 w-full rounded-lg bg-surface-2 pl-8 pr-2.5 text-xs text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-surface-3"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-x-4">
                    {LINK_TYPES.map((t) => (
                        <LegendType key={t} type={t} on={!hidden.has(t)} count={counts[t]} onChange={() => toggleType(t)} />
                    ))}
                </div>

                {/* Ties, moments, or both — one choice, written as three words:
                    the one in force underlined */}
                {momentCount > 0 && (
                    <div className="inline-flex h-7 items-center gap-2.5 text-[12.5px]">
                        {(["all", "tie", "event"] as const).map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setKind(k)}
                                aria-pressed={kind === k}
                                className={`transition-colors cursor-pointer ${kind === k ? "text-fg underline decoration-sky-400 decoration-2 underline-offset-4" : "text-fg-dim hover:text-fg"}`}
                            >
                                {k === "all" ? "All" : k === "tie" ? "Ties" : "Moments"}
                            </button>
                        ))}
                    </div>
                )}

                {/* The same stops as the slider above, and the same state:
                    picking one here moves the slider, and a step there moves
                    this. */}
                {stops.length > 0 && (
                    <select
                        value={String(stopIdx)}
                        onChange={(e) => onStop(Number(e.target.value))}
                        className="h-7 cursor-pointer bg-transparent text-[12.5px] text-fg-dim outline-none transition-colors hover:text-fg focus-visible:text-fg [&>option]:bg-panel"
                        aria-label="As of episode"
                    >
                        {stops.map(([from, to], i) => (
                            <option key={i} value={i}>
                                As of ep {from === to ? to : `${from}–${to}`}
                            </option>
                        ))}
                    </select>
                )}

                <div className="flex flex-wrap items-center gap-x-4">
                    {/* The door only when it holds something — a dated chart's twists are the slider's */}
                    {revealCount > 0 && (
                        <LegendToggle on={reveals} onChange={() => onReveals(!reveals)} mark="dash">
                            Reveals <span className="text-[11.5px] tabular-nums text-fg-dim">{revealCount}</span>
                        </LegendToggle>
                    )}
                    {filtering && (
                        <button type="button" onClick={clearFilters} className="h-7 text-xs text-fg-faint transition-colors hover:text-fg cursor-pointer">
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {listError && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">{listError}</p>}

            {/* One card a pair, not one a link: the same two people used to fill
                sixteen cards in a row with the same faces and names. Their ties
                are listed under them in the story's order, so the card reads as
                what happened between them. The leads' pairs first, then the
                busiest. */}
            <div className="space-y-2.5">
                {pairs.map(({ key, a, b, rows: pairRows }) => {
                    const ties = pairRows.filter(({ link }) => !isEvent(link)).length,
                        moments = pairRows.length - ties;
                    const isOpen = searching || opened.has(key);
                    // Where they stand: the latest tie, the line a folded card shows
                    const now = [...pairRows].reverse().find(({ link }) => !isEvent(link))?.link ?? pairRows[pairRows.length - 1].link;
                    return (
                        <div key={key} className="overflow-hidden rounded-xl border border-line-soft bg-surface-1">
                            <button
                                type="button"
                                onClick={() => togglePair(key)}
                                aria-expanded={isOpen}
                                className={`flex w-full items-center gap-3 px-3.5 text-left transition-colors hover:bg-surface-2 cursor-pointer ${isOpen ? "pb-1.5 pt-2.5" : "py-2.5"}`}
                            >
                                <span className="flex shrink-0 items-center -space-x-2">
                                    <Face person={byId.get(a) ?? null} size="sm" />
                                    <Face person={byId.get(b) ?? null} size="sm" />
                                </span>
                                <span className="min-w-0 shrink truncate text-sm font-semibold text-fg">
                                    {name(a)} <span className="font-normal text-fg-faint">&amp;</span> {name(b)}
                                </span>
                                {!isOpen && (
                                    <span className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                                        <TieMark type={now.type} reveal={now.reveal} inferred={now.inferred} moment={isEvent(now)} />
                                        <span className={`truncate text-[13px] text-fg-dim ${now.reveal ? "italic" : ""}`}>{now.short || now.label}</span>
                                    </span>
                                )}
                                <span className="ml-auto shrink-0 text-xs tabular-nums text-fg-dim">
                                    {ties > 0 && `${ties} tie${ties === 1 ? "" : "s"}`}
                                    {ties > 0 && moments > 0 && " · "}
                                    {moments > 0 && `${moments} moment${moments === 1 ? "" : "s"}`}
                                </span>
                                <ChevronRight className={`h-4 w-4 shrink-0 text-fg-dim transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            </button>
                            {isOpen && (
                                <ul className="pb-1.5 pl-3 pr-1.5 sm:pl-[3.25rem]">
                                    {pairRows.map(({ link, index }) => {
                                        const eps = episodeText(link);
                                        const moment = isEvent(link);
                                        const open = canEdit ? () => openEdit(index) : undefined;
                                        return (
                                            <li
                                                key={index}
                                                id={`relationship-${index}`}
                                                onClick={open}
                                                onKeyDown={open && ((e) => { if (e.key === "Enter") open(); })}
                                                role={canEdit ? "button" : undefined}
                                                tabIndex={canEdit ? 0 : undefined}
                                                title={[link.evidence, link.wholeStory === false ? "Not in the whole story" : null].filter(Boolean).join(" · ") || undefined}
                                                className={`group flex min-h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] transition-colors ${
                                                    highlight === index ? "bg-sky-400/10 ring-1 ring-sky-400/40" : ""
                                                } ${canEdit ? "cursor-pointer hover:bg-surface-2" : ""} ${busy === index ? "opacity-50" : ""}`}
                                            >
                                                <TieMark type={link.type} reveal={link.reveal} inferred={link.inferred} moment={moment} />
                                                <span className={`min-w-0 flex-1 truncate ${moment ? "text-fg-muted" : "text-fg-soft"} ${link.reveal ? "italic" : ""}`}>{link.short || link.label}</span>
                                                {/* The way it points, only when it points: an undirected tie needs no arrow */}
                                                {link.directed && (
                                                    <span className="hidden shrink-0 text-xs text-fg-dim sm:inline">
                                                        {name(link.from)} → {name(link.to)}
                                                    </span>
                                                )}
                                                <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-fg-dim">{eps}</span>
                                                {canEdit && (
                                                    <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                        <button type="button" onClick={() => openEdit(index)} className={iconBtn} title="Edit" aria-label="Edit relationship">
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button type="button" onClick={() => openDuplicate(index)} className={iconBtn} title="Duplicate" aria-label="Duplicate relationship">
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                        <Popover open={confirming === index} onOpenChange={(o) => setConfirming(o ? index : null)}>
                                                            <PopoverTrigger asChild>
                                                                <button type="button" disabled={busy === index} className={`${iconBtn} hover:text-red-400`} title="Delete" aria-label="Delete relationship">
                                                                    {busy === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent align="end" className="w-64 space-y-2.5">
                                                                <p className="text-sm font-medium text-fg">Delete relationship?</p>
                                                                <p className="text-xs text-fg-dim">
                                                                    {name(link.from)} {link.directed ? "→" : "↔"} {name(link.to)} · {link.short || link.label}
                                                                </p>
                                                                <div className="flex justify-end gap-2 pt-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setConfirming(null)}
                                                                        className="rounded-md px-2 py-1 text-xs text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg cursor-pointer"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => remove(index)}
                                                                        className="rounded-md bg-red-500/90 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-red-500 cursor-pointer"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>

            {rows.length === 0 && (
                <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-fg-dim">
                    {filtering ? "No relationship matches these filters." : "This chart has no relationships yet."}
                </p>
            )}

            {editing && (
                <RelationshipEditor
                    key={`${editing.mode}-${editing.index ?? "new"}`}
                    map={map}
                    initial={editing.draft}
                    mode={editing.mode}
                    saving={saving}
                    error={editorError}
                    onCancel={() => setEditing(null)}
                    onSave={save}
                />
            )}
        </section>
    );
}
