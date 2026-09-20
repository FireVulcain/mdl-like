"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeftRight, ChevronsUpDown, Loader2, Search, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { SettingToggle } from "@/components/settings/setting-toggle";
import { LINK_TYPES, TYPE_CLASS, TYPE_GLYPH, TYPE_LABEL, type CharacterMapData, type LinkType, type MapPerson } from "@/lib/character-map";
import { draftWarnings, validateDraft, type DraftErrors, type LinkDraft } from "@/lib/character-map-links";
import { Face, TypeMark } from "./character-map-bits";

/**
 * One relationship, in a panel beside the chart it belongs to.
 *
 * The form is the JSON, read out loud: two characters picked by their faces,
 * a kind of tie in the colour the chart draws it, the words, the episodes it
 * holds between, and the three flags as switches that say what they mean.
 * Nothing here knows about JSON — it works on a `LinkDraft`, which
 * character-map-links.ts turns back into a link on the way out.
 *
 * The preview at the bottom is the link as the chart's own panel would show
 * it, and it moves with every keystroke: the answer to "what am I writing".
 */

/* ------------------------------------------------------------- the pieces */

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-baseline gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-fg-dim">{label}</label>
                {hint && !error && <span className="text-[11px] text-fg-faint">{hint}</span>}
            </div>
            {children}
            {error && <p className="text-[11px] text-red-400">{error}</p>}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3 border-t border-line pt-5 first:border-0 first:pt-0">
            <h3 className="font-display text-sm font-semibold text-fg">{title}</h3>
            {children}
        </section>
    );
}

const inputClass =
    "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-line-strong focus:bg-surface-2";

/**
 * The picker's list, in the panel's own DOM rather than in a portal at the
 * end of the body. A dialog is modal: it turns off pointer events everywhere
 * outside itself and keeps the focus in, so a portalled list could be neither
 * clicked, scrolled nor typed into. Radix positions it `fixed`, so staying
 * inside the panel costs it nothing — the scrolling form does not clip it.
 */
function PickerList({ className = "", ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Content
            align="start"
            sideOffset={6}
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={`z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-lg border border-line-strong bg-panel text-sm text-fg shadow-xl shadow-black/50 outline-none animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 ${className}`}
            {...props}
        />
    );
}

/**
 * A character, picked by face. Never an id typed by hand: everyone in the
 * chart is in this list, with the actor and the household under the name,
 * and the search reads all three.
 */
function CharacterPicker({ map, value, exclude, onPick, error }: { map: CharacterMapData; value: string; exclude?: string; onPick: (id: string) => void; error?: string }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const person = map.people.find((p) => p.id === value) ?? null;
    const leads = useMemo(() => new Set(map.compact.center ?? map.main.slice(0, 2)), [map]);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        const pool = map.people.filter((p) => p.id !== exclude);
        const hit = (p: MapPerson) => !q || [p.name, p.actor, p.group, p.id].some((s) => s?.toLowerCase().includes(q));
        // the leads first, then the households in the order the chart lists them
        return pool.filter(hit).sort((a, b) => Number(leads.has(b.id)) - Number(leads.has(a.id)));
    }, [map, query, exclude, leads]);

    const choose = (id: string) => {
        onPick(id);
        setOpen(false);
        setQuery("");
    };

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
            <PopoverPrimitive.Trigger asChild>
                <button
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-lg border bg-surface-1 px-3 py-2.5 text-left transition-colors hover:bg-surface-2 cursor-pointer ${
                        error ? "border-red-500/50" : "border-line hover:border-line-strong"
                    }`}
                >
                    {person ? (
                        <>
                            <Face person={person} size="md" />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-fg">{person.name}</span>
                                <span className="block truncate font-mono text-[11px] text-fg-dim">{person.actor}</span>
                            </span>
                        </>
                    ) : (
                        <span className="py-1.5 text-sm text-fg-dim">Select character</span>
                    )}
                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-fg-faint" />
                </button>
            </PopoverPrimitive.Trigger>
            <PickerList>
                <div className="flex items-center gap-2 border-b border-line px-3 py-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                        onKeyDown={(e) => {
                            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(matches.length - 1, i + 1)); }
                            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
                            else if (e.key === "Enter" && matches[active]) { e.preventDefault(); choose(matches[active].id); }
                        }}
                        placeholder="Search character…"
                        className="w-full bg-transparent text-sm text-fg placeholder:text-fg-faint outline-none"
                    />
                </div>
                <div className="max-h-72 overflow-y-auto p-1">
                    {matches.map((p, i) => (
                        <button
                            key={p.id}
                            type="button"
                            onMouseEnter={() => setActive(i)}
                            onClick={() => choose(p.id)}
                            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer ${
                                i === active ? "bg-surface-3" : ""
                            } ${p.id === value ? "ring-1 ring-inset ring-line-strong" : ""}`}
                        >
                            <Face person={p} size="sm" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm text-fg">{p.name}</span>
                                <span className="block truncate font-mono text-[11px] text-fg-dim">{p.actor}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-fg-dim">{leads.has(p.id) ? "Lead" : p.group}</span>
                        </button>
                    ))}
                    {matches.length === 0 && <p className="px-3 py-6 text-center text-xs text-fg-dim">Nobody in this chart matches.</p>}
                </div>
            </PickerList>
        </PopoverPrimitive.Root>
    );
}

/** An episode number, or nothing. Empty means the link is not dated at that end. */
function EpisodeInput({ value, onChange, max, placeholder }: { value: number | null; onChange: (n: number | null) => void; max?: number; placeholder: string }) {
    return (
        <div className="relative">
            <input
                type="number"
                min={1}
                max={max || undefined}
                value={value ?? ""}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value === "" ? null : Math.trunc(Number(e.target.value)))}
                className={`${inputClass} pr-8 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
            />
            {value != null && (
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="absolute inset-y-0 right-2 my-auto h-5 w-5 rounded text-fg-faint transition-colors hover:text-fg cursor-pointer"
                    aria-label="Clear"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

/** A flag as the preview shows it: filled when it is on. */
function FlagDot({ on, label }: { on: boolean; label: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] ${on ? "text-fg-soft" : "text-fg-faint"}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${on ? "bg-sky-400" : "border border-fg-faint"}`} />
            {label}
        </span>
    );
}

/** What the chart will say, as it is written. */
export function RelationshipPreview({ draft, map }: { draft: LinkDraft; map: CharacterMapData }) {
    const from = map.people.find((p) => p.id === draft.from) ?? null;
    const to = map.people.find((p) => p.id === draft.to) ?? null;
    const episodes =
        draft.since == null && draft.until == null
            ? "Always shown"
            : draft.until == null
              ? `From episode ${draft.since}`
              : draft.since == null
                ? `Up to episode ${draft.until}`
                : draft.since === draft.until
                  ? `Episode ${draft.since}`
                  : `Episodes ${draft.since}–${draft.until}`;
    return (
        <div className="overflow-hidden rounded-xl border border-line-soft bg-surface-1">
            <div className={`h-0.5 w-full bg-current ${TYPE_CLASS[draft.type]}`} />
            <div className="space-y-2.5 px-4 py-3">
                <div className="flex items-center gap-2.5">
                    <Face person={from} size="md" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{from?.name ?? "—"}</span>
                    <span className={`shrink-0 text-sm ${TYPE_CLASS[draft.type]}`}>{draft.directed ? "→" : "↔"}</span>
                    <span className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-fg">{to?.name ?? "—"}</span>
                    <Face person={to} size="md" />
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <TypeMark type={draft.type} />
                    {draft.short.trim() && <span className={`rounded-full border border-current/40 px-2 py-0.5 text-[11px] font-medium ${TYPE_CLASS[draft.type]}`}>{draft.short.trim()}</span>}
                    <span className="ml-auto text-[11px] tabular-nums text-fg-dim">{episodes}</span>
                </div>
                {draft.label.trim() && <p className="text-xs text-fg-soft">{draft.label.trim()}</p>}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft pt-2">
                    <FlagDot on={draft.directed} label="Directed" />
                    <FlagDot on={draft.inferred} label="Inferred" />
                    <FlagDot on={draft.reveal} label="Reveal" />
                </div>
            </div>
        </div>
    );
}

/* ------------------------------------------------------------- the panel */

export type EditorMode = "create" | "edit" | "duplicate";

export function RelationshipEditor({
    map,
    initial,
    mode,
    saving,
    error,
    onCancel,
    onSave,
}: {
    map: CharacterMapData;
    initial: LinkDraft;
    mode: EditorMode;
    saving: boolean;
    error: string | null;
    onCancel: () => void;
    onSave: (draft: LinkDraft) => void;
}) {
    const [draft, setDraft] = useState<LinkDraft>(initial);
    // Errors only after a first attempt: a form that is red before it has
    // been filled in is nagging, one that stays green after a failed save is
    // lying.
    const [tried, setTried] = useState(false);
    const errors: DraftErrors = useMemo(() => validateDraft(draft, map), [draft, map]);
    const warnings = useMemo(() => draftWarnings(draft, map), [draft, map]);
    const shown = tried ? errors : {};
    const set = <K extends keyof LinkDraft>(key: K, value: LinkDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
    const bodyRef = useRef<HTMLDivElement>(null);

    const title = mode === "edit" ? "Edit relationship" : mode === "duplicate" ? "Duplicate relationship" : "New relationship";
    const sources = useMemo(() => [...new Set(map.links.map((l) => l.source).filter(Boolean) as string[])].sort(), [map]);
    const covered = map.recaps?.episodes ?? 0;

    const submit = () => {
        setTried(true);
        if (Object.keys(errors).length > 0) {
            bodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            return;
        }
        onSave(draft);
    };

    return (
        <Sheet open onOpenChange={(o) => !o && !saving && onCancel()}>
            <SheetContent className="max-w-lg" onInteractOutside={(e) => saving && e.preventDefault()}>
                <SheetHeader>
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>
                        {mode === "duplicate"
                            ? "A copy of the original — change what differs and save it as its own link."
                            : "The chart is read out of the sources; every link keeps the sentence it came from."}
                    </SheetDescription>
                </SheetHeader>

                <div ref={bodyRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    <Section title="Characters">
                        <div className="space-y-2">
                            <CharacterPicker map={map} value={draft.from} exclude={draft.to} onPick={(id) => set("from", id)} error={shown.from} />
                            {/* Which way the tie reads, set where it is seen:
                                between the two faces it runs between. It is
                                the link's `directed`, and the only control
                                for it — a second switch under Metadata would
                                be the same state twice. */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center rounded-lg bg-surface-2 p-0.5">
                                    {([true, false] as const).map((on) => (
                                        <button
                                            key={String(on)}
                                            type="button"
                                            onClick={() => set("directed", on)}
                                            aria-pressed={draft.directed === on}
                                            className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-all cursor-pointer ${
                                                draft.directed === on ? `bg-surface-4 ring-1 ring-line-strong ${TYPE_CLASS[draft.type]}` : "text-fg-dim hover:text-fg"
                                            }`}
                                        >
                                            <span aria-hidden>{on ? "→" : "↔"}</span>
                                            {on ? "From → to" : "Both ways"}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setDraft((d) => ({ ...d, from: d.to, to: d.from }))}
                                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2 py-1 text-[11px] text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg cursor-pointer"
                                >
                                    <ArrowLeftRight className="h-3 w-3" />
                                    Swap
                                </button>
                            </div>
                            <CharacterPicker map={map} value={draft.to} exclude={draft.from} onPick={(id) => set("to", id)} error={shown.to} />
                            <p className="text-[11px] text-fg-faint">
                                {draft.directed
                                    ? "The label reads from the first to the second — “mother” means the first is the second’s mother. The chart draws an arrow."
                                    : "A tie that reads the same both ways — married, friends, rivals. The chart draws a plain line."}
                            </p>
                        </div>
                    </Section>

                    <Section title="Relationship">
                        <Field label="Type">
                            <div className="flex flex-wrap gap-1.5">
                                {LINK_TYPES.map((t) => (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => set("type", t as LinkType)}
                                        aria-pressed={draft.type === t}
                                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                                            draft.type === t ? `bg-surface-4 ring-1 ring-line-strong ${TYPE_CLASS[t]}` : "bg-surface-2 text-fg-dim hover:bg-surface-3 hover:text-fg"
                                        }`}
                                    >
                                        <span aria-hidden>{TYPE_GLYPH[t]}</span>
                                        {TYPE_LABEL[t]}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="Label" hint="the full reading" error={shown.label}>
                            <input value={draft.label} onChange={(e) => set("label", e.target.value)} placeholder="fall in love — she saves his life on the rooftop" className={inputClass} />
                        </Field>
                        <Field label="Short" hint="one to three words, drawn under the face" error={shown.short}>
                            <input value={draft.short} onChange={(e) => set("short", e.target.value)} placeholder="in love" maxLength={40} className={inputClass} />
                        </Field>
                    </Section>

                    <Section title="Episodes">
                        <p className="text-[11px] text-fg-faint">
                            {covered > 0
                                ? `The recaps cover episodes 1–${covered}; the "By episode" slider stops where each one ends.`
                                : "This chart has no recaps yet — dating a link turns on the chart's “By episode” view."}
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Field label="First appearance" error={shown.since}>
                                <EpisodeInput value={draft.since} onChange={(n) => set("since", n)} max={Math.max(covered, 999)} placeholder="always" />
                            </Field>
                            <Field label="Active until" error={shown.until}>
                                <EpisodeInput value={draft.until} onChange={(n) => set("until", n)} max={Math.max(covered, 999)} placeholder="never ends" />
                            </Field>
                        </div>
                        <p className="text-[11px] text-fg-faint">
                            A tie that changes is two links: the first one ends where the second begins — &ldquo;bond, 1 to 4&rdquo;, then &ldquo;romance, from 5&rdquo;.
                        </p>
                    </Section>

                    <Section title="Metadata">
                        <div className="space-y-3.5">
                            <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Reveal</span>
                                <SettingToggle
                                    checked={draft.reveal}
                                    onChange={(v) => set("reveal", v)}
                                    label={draft.reveal ? "Revealed later" : "Not a twist"}
                                    hint="A twist the story keeps for later — hidden until the reader opens the reveals."
                                />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-semibold uppercase tracking-wide text-fg-dim">Inferred</span>
                                <SettingToggle
                                    checked={draft.inferred}
                                    onChange={(v) => set("inferred", v)}
                                    label={draft.inferred ? "Inferred" : "Explicit"}
                                    hint="No sentence in the sources backs it — the chart draws it faded."
                                />
                            </div>
                        </div>
                    </Section>

                    <Section title="Evidence">
                        <Field label="Sentence" hint="what it was read from">
                            <textarea
                                value={draft.evidence}
                                onChange={(e) => set("evidence", e.target.value)}
                                rows={3}
                                placeholder="[Yeon Ju's father] / 연주의 아버지"
                                className={`${inputClass} resize-y leading-relaxed`}
                            />
                        </Field>
                        <Field label="Source" hint="where it was read">
                            <input value={draft.source} onChange={(e) => set("source", e.target.value)} list="cm-sources" placeholder="MDL cast" className={inputClass} />
                            <datalist id="cm-sources">
                                {sources.map((s) => (
                                    <option key={s} value={s} />
                                ))}
                            </datalist>
                        </Field>
                        {warnings.map((w) => (
                            <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-400/90">
                                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                                {w}
                            </p>
                        ))}
                    </Section>

                    <Section title="Preview">
                        <RelationshipPreview draft={draft} map={map} />
                    </Section>
                </div>

                <SheetFooter>
                    {error && <span className="mr-auto max-w-[55%] text-xs text-red-400">{error}</span>}
                    {!error && tried && Object.keys(errors).length > 0 && <span className="mr-auto text-xs text-red-400">Some fields need a look.</span>}
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={saving}
                        className="ml-auto rounded-lg px-3 py-2 text-sm text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-50 cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg bg-sky-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-60 cursor-pointer"
                    >
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        {mode === "edit" ? "Save changes" : "Create relationship"}
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
