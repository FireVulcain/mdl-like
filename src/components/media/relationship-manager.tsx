"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Filter, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    lastDatedEpisode,
    linkActiveAt,
    LINK_TYPES,
    TYPE_CLASS,
    TYPE_GLYPH,
    TYPE_LABEL,
    type CharacterMapData,
    type LinkType,
    type MapLink,
    type MapPerson,
} from "@/lib/character-map";
import { draftFrom, emptyDraft, fingerprint, linkFrom, type LinkDraft } from "@/lib/character-map-links";
import { deleteRelationship, saveRelationship } from "@/actions/character-map-links";
import { Face, pill, TypeMark } from "./character-map-bits";
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
 */

type Row = { link: MapLink; index: number };

/** What the row says about a link in three words, in the type's colour. */
function Badge({ children, tone = "" }: { children: React.ReactNode; tone?: string }) {
    return <span className={`rounded bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tone || "text-fg-dim"}`}>{children}</span>;
}

function episodeText(l: MapLink): string | null {
    if (l.since == null && l.until == null) return null;
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
    onMap,
}: {
    map: CharacterMapData;
    mdlSlug: string;
    mediaId: string;
    canEdit: boolean;
    /** the page's spoiler door, shared with the chart above */
    reveals: boolean;
    onReveals: (next: boolean) => void;
    onMap: (next: CharacterMapData) => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [types, setTypes] = useState<Set<LinkType>>(new Set());
    const [episode, setEpisode] = useState<number | null>(null);
    const [flags, setFlags] = useState<{ inferred: boolean; directed: boolean }>({ inferred: false, directed: false });
    const [editing, setEditing] = useState<{ mode: EditorMode; index: number | null; expect: string | null; original: MapLink | null; draft: LinkDraft } | null>(null);
    const [saving, setSaving] = useState(false);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const [listError, setListError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<number | null>(null);

    const byId = useMemo(() => new Map(map.people.map((p) => [p.id, p])), [map]);
    const episodes = useMemo(() => lastDatedEpisode(map.links), [map]);
    const name = (id: string) => byId.get(id)?.name ?? id;

    const all = useMemo<Row[]>(
        () => map.links.map((link, index) => ({ link, index })).filter(({ link }) => reveals || !link.reveal),
        [map, reveals],
    );
    const revealCount = useMemo(() => map.links.filter((l) => l.reveal).length, [map]);

    const rows = useMemo<Row[]>(() => {
        const q = query.trim().toLowerCase();
        return all
            .filter(({ link }) => {
                if (types.size && !types.has(link.type)) return false;
                if (episode != null && !linkActiveAt(link, episode)) return false;
                if (flags.inferred && !link.inferred) return false;
                if (flags.directed && !link.directed) return false;
                if (!q) return true;
                const people = [byId.get(link.from), byId.get(link.to)].filter(Boolean) as MapPerson[];
                const hay = [link.label, link.short, link.evidence, link.source, ...people.flatMap((p) => [p.name, p.actor])];
                return hay.some((s) => s?.toLowerCase().includes(q));
            });
    }, [all, byId, query, types, episode, flags]);

    const filtering = !!query.trim() || types.size > 0 || episode != null || flags.inferred || flags.directed;
    const counts = useMemo(() => Object.fromEntries(LINK_TYPES.map((t) => [t, all.filter(({ link }) => link.type === t).length])) as Record<LinkType, number>, [all]);

    const toggleType = (t: LinkType) =>
        setTypes((prev) => {
            const next = new Set(prev);
            if (!next.delete(t)) next.add(t);
            return next;
        });

    const clearFilters = () => {
        setQuery("");
        setTypes(new Set());
        setEpisode(null);
        setFlags({ inferred: false, directed: false });
    };

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
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-fg-dim opacity-70 transition-all hover:bg-surface-3 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-40 cursor-pointer";

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 className="font-display text-lg font-semibold text-fg">All relationships</h2>
                    <p className="text-sm text-fg-muted">
                        {all.length} relationship{all.length === 1 ? "" : "s"}
                        {filtering && <span className="text-fg-dim"> · {rows.length} shown</span>}
                        {!reveals && revealCount > 0 && <span className="text-fg-dim"> · {revealCount} behind the reveals</span>}
                    </p>
                </div>
                {canEdit && (
                    <button
                        type="button"
                        onClick={openCreate}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 cursor-pointer"
                    >
                        <Plus className="h-4 w-4" />
                        Add relationship
                    </button>
                )}
            </div>

            {/* Filters: the questions asked of a list like this — who, what
                kind, when, and which of the three marks. They combine. */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, label, evidence…"
                        className="h-7 w-full rounded-lg bg-surface-2 pl-8 pr-2.5 text-xs text-fg placeholder:text-fg-faint outline-none transition-colors focus:bg-surface-3"
                    />
                </div>

                <Popover>
                    <PopoverTrigger asChild>
                        <button type="button" className={pill(types.size > 0)}>
                            <Filter className="h-3 w-3" />
                            {types.size === 0 ? "Type" : types.size === 1 ? TYPE_LABEL[[...types][0]] : `${types.size} types`}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-52 p-1.5">
                        {LINK_TYPES.map((t) => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => toggleType(t)}
                                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                                    types.has(t) ? "bg-surface-3 text-fg" : "text-fg-dim hover:bg-surface-2 hover:text-fg"
                                }`}
                            >
                                <span aria-hidden className={TYPE_CLASS[t]}>
                                    {TYPE_GLYPH[t]}
                                </span>
                                {TYPE_LABEL[t]}
                                <span className="ml-auto tabular-nums text-fg-faint">{counts[t]}</span>
                            </button>
                        ))}
                    </PopoverContent>
                </Popover>

                {episodes > 0 && (
                    <select
                        value={episode ?? ""}
                        onChange={(e) => setEpisode(e.target.value === "" ? null : Number(e.target.value))}
                        className="h-7 cursor-pointer rounded-lg bg-surface-2 px-2 text-xs text-fg-dim outline-none transition-colors hover:bg-surface-3 hover:text-fg [&>option]:bg-panel"
                        aria-label="As of episode"
                    >
                        <option value="">Any episode</option>
                        {Array.from({ length: episodes }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                                As of episode {n}
                            </option>
                        ))}
                    </select>
                )}

                {/* The door first, then the two filters — the same order, and the
                    same separator, as the row of pills over the chart. */}
                <button type="button" onClick={() => onReveals(!reveals)} aria-pressed={reveals} className={pill(reveals)} disabled={revealCount === 0}>
                    Reveals <span className="opacity-50">{revealCount}</span>
                </button>

                <div className="h-4 w-px bg-surface-3" />

                {(["inferred", "directed"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFlags((v) => ({ ...v, [f]: !v[f] }))} aria-pressed={flags[f]} className={pill(flags[f])}>
                        Only {f === "inferred" ? "inferred" : "directed"}
                    </button>
                ))}

                {filtering && (
                    <button type="button" onClick={clearFilters} className="text-xs text-fg-faint transition-colors hover:text-fg cursor-pointer">
                        Clear
                    </button>
                )}
            </div>

            {listError && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">{listError}</p>}

            <ul className="space-y-1.5">
                {rows.map(({ link, index }) => {
                    const from = byId.get(link.from) ?? null;
                    const to = byId.get(link.to) ?? null;
                    const eps = episodeText(link);
                    const open = canEdit ? () => openEdit(index) : undefined;
                    return (
                        <li
                            key={index}
                            onClick={open}
                            onKeyDown={open && ((e) => { if (e.key === "Enter") open(); })}
                            role={canEdit ? "button" : undefined}
                            tabIndex={canEdit ? 0 : undefined}
                            title={link.evidence ?? undefined}
                            className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border border-line-soft bg-surface-1 py-2.5 pl-4 pr-2.5 transition-colors ${
                                canEdit ? "cursor-pointer hover:border-line hover:bg-surface-2" : ""
                            } ${busy === index ? "opacity-50" : ""}`}
                        >
                            <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] bg-current ${TYPE_CLASS[link.type]} ${link.inferred ? "opacity-40" : ""}`} />

                            <span className="flex shrink-0 items-center -space-x-2">
                                <Face person={from} size="md" />
                                <Face person={to} size="md" />
                            </span>

                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-1.5 text-sm">
                                    <span className="truncate font-medium text-fg">{name(link.from)}</span>
                                    <span className={`shrink-0 ${TYPE_CLASS[link.type]}`}>{link.directed ? "→" : "↔"}</span>
                                    <span className="truncate font-medium text-fg">{name(link.to)}</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <TypeMark type={link.type} />
                                    <span className="truncate text-xs text-fg-soft">{link.short || link.label}</span>
                                    {eps && <span className="shrink-0 font-mono text-[11px] tabular-nums text-fg-dim">{eps}</span>}
                                    {link.reveal && <Badge tone="text-amber-400/90">Reveal</Badge>}
                                    {link.inferred && <Badge>Inferred</Badge>}
                                    {link.directed && <Badge>Directed</Badge>}
                                </div>
                            </div>

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
