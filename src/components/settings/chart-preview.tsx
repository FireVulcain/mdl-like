"use client";

import { useRef, useState } from "react";
import { FileJson, Upload, X } from "lucide-react";
import { CharacterMap } from "@/components/media/character-map";
import type { CharacterMapData, MapLink, MapPerson } from "@/lib/character-map";

/**
 * A relationship chart from a JSON file on the reader's own disk, drawn the
 * way the relationships page draws one — nothing is uploaded or saved: the
 * file is read in the browser and forgotten with the tab.
 *
 * The file is the format in prisma/character-maps/README.md. Only `people`
 * and `links` are required; the rest is filled in so a chart written by hand
 * in a hurry still draws.
 */

type Loaded = { name: string; at: number; map: CharacterMapData; warnings: string[] };

function readChart(text: string): { map: CharacterMapData; warnings: string[] } {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (e) {
        throw new Error(`Not valid JSON: ${(e as Error).message}`);
    }
    const r = raw as Partial<CharacterMapData> | null;
    if (!r || typeof r !== "object") throw new Error("The file is not a JSON object.");
    if (!Array.isArray(r.people) || r.people.length === 0) throw new Error("`people` is missing or empty.");
    if (!Array.isArray(r.links)) throw new Error("`links` is missing.");

    const warnings: string[] = [];
    const people: MapPerson[] = r.people.map((p, i) => {
        if (!p || typeof p.id !== "string" || !p.id) throw new Error(`people[${i}] has no id.`);
        return { ...p, name: p.name || p.id, actor: p.actor ?? "", image: p.image ?? null, group: p.group || "Others", inCast: p.inCast ?? true };
    });
    const ids = new Set(people.map((p) => p.id));
    const links: MapLink[] = [];
    r.links.forEach((l, i) => {
        if (!l || !ids.has(l.from) || !ids.has(l.to)) {
            warnings.push(`links[${i}] (${l?.from ?? "?"} → ${l?.to ?? "?"}) names somebody who is not in people — left out.`);
            return;
        }
        links.push({ ...l, type: l.type ?? "bond", label: l.label ?? "", short: l.short ?? "", evidence: l.evidence ?? null, source: l.source ?? null, reveal: !!l.reveal, inferred: !!l.inferred, directed: !!l.directed });
    });
    const main = Array.isArray(r.main) && r.main.length ? r.main.filter((id) => ids.has(id)) : people.slice(0, 2).map((p) => p.id);
    if (!Array.isArray(r.main) || r.main.length === 0) warnings.push("No `main` — the first two people are drawn as the leads.");

    const map: CharacterMapData = {
        ...(r as CharacterMapData),
        version: r.version ?? 2,
        mdlSlug: r.mdlSlug ?? "preview",
        title: r.title ?? "Preview",
        sources: r.sources ?? [],
        main,
        people,
        links,
        compact: { people: r.compact?.people ?? people.map((p) => p.id), blocks: r.compact?.blocks ?? {}, ...(r.compact?.center ? { center: r.compact.center } : {}) },
    };
    return { map, warnings };
}

export function ChartPreview() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [over, setOver] = useState(false);

    const open = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        try {
            const { map, warnings } = readChart(await file.text());
            setLoaded({ name: file.name, at: Date.now(), map, warnings });
        } catch (e) {
            setLoaded(null);
            setError((e as Error).message);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-xs text-fg-faint leading-snug">
                Draw a chart from a JSON file in the format of <code className="font-mono">prisma/character-maps/</code>. The file stays in your browser — nothing is saved.
            </p>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setOver(false);
                    void open(e.dataTransfer.files[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                    over ? "border-sky-400 bg-sky-400/5" : "border-line hover:border-line-strong hover:bg-surface-1"
                }`}
            >
                <Upload className="h-5 w-5 text-fg-dim" />
                <span className="text-sm text-fg-soft">Drop a .json file here, or click to pick one</span>
                <input
                    ref={inputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                        void open(e.target.files?.[0]);
                        // the same file picked again after an edit must load again
                        e.target.value = "";
                    }}
                />
            </div>

            {error && <p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-400">{error}</p>}

            {loaded && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                        <FileJson className="h-4 w-4 text-fg-dim" />
                        <span className="font-medium text-fg">{loaded.map.title}</span>
                        <span className="font-mono text-[11px] text-fg-dim">
                            {loaded.name} · {loaded.map.people.length} people · {loaded.map.links.length} links
                        </span>
                        <button
                            type="button"
                            onClick={() => setLoaded(null)}
                            className="ml-auto cursor-pointer rounded-md p-1 text-fg-dim transition-colors hover:bg-surface-2 hover:text-fg"
                            aria-label="Close the preview"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    {loaded.warnings.length > 0 && (
                        <ul className="space-y-1 text-[11px] text-amber-400/90">
                            {loaded.warnings.map((w) => (
                                <li key={w}>{w}</li>
                            ))}
                        </ul>
                    )}
                    {/* Keyed by the load, so a new file starts from the chart's own defaults */}
                    <CharacterMap key={loaded.at} map={loaded.map} completed />
                </div>
            )}
        </div>
    );
}
