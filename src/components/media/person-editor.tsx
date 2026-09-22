"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SettingToggle } from "@/components/settings/setting-toggle";
import type { CharacterMapData, MapPerson } from "@/lib/character-map";
import { linksOf, validatePersonDraft, type PersonDraft, type PersonErrors } from "@/lib/character-map-people";
import { Face } from "./character-map-bits";

/**
 * One character, in the same side panel as a relationship.
 *
 * Mostly for the people MDL's cast does not carry — the killer the webtoon
 * draws without a face, a victim seen only in flashbacks — who could be
 * named in a link only once someone had added them to the file by hand. The
 * household is picked from the chart's own, or a new one typed in; the
 * pictures are links, and the face at the bottom is the chart's own drawing
 * of them, dashed ring and all while the person is outside MDL's cast.
 */

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

const inputClass =
    "w-full rounded-lg border border-line bg-surface-1 px-3 py-2 text-sm text-fg placeholder:text-fg-faint outline-none transition-colors focus:border-line-strong focus:bg-surface-2";

export function PersonEditor({
    map,
    person,
    initial,
    saving,
    error,
    onCancel,
    onSave,
    onDelete,
}: {
    map: CharacterMapData;
    /** the person being edited, or null for a new one */
    person: MapPerson | null;
    initial: PersonDraft;
    saving: boolean;
    error: string | null;
    onCancel: () => void;
    onSave: (draft: PersonDraft) => void;
    onDelete?: () => void;
}) {
    const [draft, setDraft] = useState<PersonDraft>(initial);
    const [tried, setTried] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const errors: PersonErrors = useMemo(() => validatePersonDraft(draft, map, person?.id ?? null), [draft, map, person]);
    const shown = tried ? errors : {};
    const set = <K extends keyof PersonDraft>(key: K, value: PersonDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
    const groups = useMemo(() => [...new Set(map.people.map((p) => p.group))].sort(), [map]);
    const links = person ? linksOf(map, person.id) : 0;

    const submit = () => {
        setTried(true);
        if (Object.keys(errors).length === 0) onSave(draft);
    };

    // What the chart will draw: the still if there is one, the headshot
    // otherwise, the placeholder when neither — and the dashed ring outside the cast.
    const face = { name: draft.name, image: draft.image.trim() || null, still: draft.still.trim() || null, inCast: draft.inCast };

    return (
        <Sheet open onOpenChange={(o) => !o && !saving && onCancel()}>
            <SheetContent className="max-w-lg" onInteractOutside={(e) => saving && e.preventDefault()}>
                <SheetHeader>
                    <SheetTitle>{person ? "Edit character" : "New character"}</SheetTitle>
                    <SheetDescription>
                        {person ? `${links} relationship${links === 1 ? "" : "s"} name ${person.name}.` : "Someone the story has and MDL's cast does not — once added, they can be picked in a relationship."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                    <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-surface-1 px-4 py-3">
                        <Face person={face} size="lg" />
                        <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-fg">{draft.name.trim() || "—"}</span>
                            <span className="block truncate font-mono text-[11px] text-fg-dim">{draft.actor.trim() || "no actor"}</span>
                            <span className="block truncate text-[11px] text-fg-faint">{draft.group.trim() || "no household"}</span>
                        </span>
                    </div>

                    <Field label="Name" hint="as written under the face" error={shown.name}>
                        <input value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Han Sang Hoon / the faceless killer" className={inputClass} autoFocus />
                    </Field>
                    <Field label="Actor" hint="empty when nobody is credited">
                        <input value={draft.actor} onChange={(e) => set("actor", e.target.value)} placeholder="Kim Eui Sung" className={inputClass} />
                    </Field>
                    <Field label="Household" hint="one of the chart's, or a new one" error={shown.group}>
                        <input value={draft.group} onChange={(e) => set("group", e.target.value)} list="cm-groups" placeholder="The Killer" className={inputClass} />
                        <datalist id="cm-groups">
                            {groups.map((g) => (
                                <option key={g} value={g} />
                            ))}
                        </datalist>
                    </Field>
                    <div className="space-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-fg-dim">MDL cast</span>
                        <SettingToggle
                            checked={draft.inCast}
                            onChange={(v) => set("inCast", v)}
                            label={draft.inCast ? "In MDL's cast" : "Not in MDL's cast"}
                            hint="Outside the cast, the face gets a dashed ring."
                        />
                    </div>
                    <Field label="Headshot" hint="a picture URL — the placeholder when empty" error={shown.image}>
                        <input value={draft.image} onChange={(e) => set("image", e.target.value)} placeholder="https://i.mydramalist.com/…_5m.jpg" className={inputClass} />
                    </Field>
                    <Field label="Still" hint="from the show — drawn in front of the headshot" error={shown.still}>
                        <input value={draft.still} onChange={(e) => set("still", e.target.value)} placeholder="https://asianwiki.com/images/…" className={inputClass} />
                    </Field>
                    <Field label="Note" hint="read in the person's panel">
                        <textarea value={draft.note} onChange={(e) => set("note", e.target.value)} rows={3} placeholder="Who they are, in a line" className={`${inputClass} resize-y leading-relaxed`} />
                    </Field>
                </div>

                <SheetFooter>
                    {error && <span className="mr-auto max-w-[55%] text-xs text-red-400">{error}</span>}
                    {!error && tried && Object.keys(errors).length > 0 && <span className="mr-auto text-xs text-red-400">Some fields need a look.</span>}
                    {/* Only someone nothing points at can go: a link to a missing face is a broken chart */}
                    {person && onDelete && !error && !(tried && Object.keys(errors).length > 0) && (
                        <button
                            type="button"
                            onClick={() => (confirming ? onDelete() : setConfirming(true))}
                            disabled={saving || links > 0}
                            title={links > 0 ? "Delete their relationships first" : undefined}
                            className="mr-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-fg-dim transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg-dim cursor-pointer disabled:cursor-default"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {confirming ? "Really delete?" : "Delete"}
                        </button>
                    )}
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
                        {person ? "Save changes" : "Add character"}
                    </button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
