"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Crosshair, Minus, Plus } from "lucide-react";
import { actorLine, ERA_LABEL, layoutCompact, linkPath, portrait, PORTRAIT_R, type CharacterMapData, type LaidOutLink, type LinkType, type MapActor, type MapPerson } from "@/lib/character-map";

// Colour follows meaning, the way it does across the app: family is the quiet
// one, romance rose, rivalry amber; teal for work and loyalty, lime for
// friendship, violet for the bonds a story invents (a soul in the wrong body).
const TYPE_CLASS: Record<LinkType, string> = {
    family: "text-slate-500 dark:text-slate-400",
    romance: "text-pink-600 dark:text-pink-400",
    rivalry: "text-amber-600 dark:text-amber-400",
    work: "text-teal-600 dark:text-teal-400",
    friend: "text-lime-600 dark:text-lime-400",
    bond: "text-violet-600 dark:text-violet-400",
};
const TYPES: LinkType[] = ["family", "romance", "rivalry", "work", "friend", "bond"];
const TYPE_LABEL: Record<LinkType, string> = { family: "Family", romance: "Romance", rivalry: "Rivalry", work: "Work", friend: "Friends", bond: "Bond" };

// A source sentence is quoted only when the reader can read it. The Korean
// and Chinese ones are what the link was read from, but to someone who reads
// neither they are noise under a label that already says the same thing in
// English — so those show their provenance alone.
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

const W = 1100;
const R = PORTRAIT_R;

// Same filter chrome as the search page: a flat fill, and a ring only on the
// one that is on.
const pill = (on: boolean, tone = "") =>
    `inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
        on ? `bg-surface-4 text-fg ring-1 ring-line-strong ${tone}` : "bg-surface-2 text-fg-dim hover:bg-surface-3 hover:text-fg"
    }`;

// Two sizes: the small one rides inside a line of text, the large one matches
// the portrait the chart draws (2 × PORTRAIT_R). A face in the panel is what
// the reader came down here to look at, so it should never be the smaller of
// the two pictures of the same person on screen.
function Face({ person, size = "sm" }: { person: { image: string | null; still?: string | null; name: string; inCast: boolean } | null; size?: "sm" | "lg" }) {
    if (!person) return null;
    const px = size === "lg" ? 2 * PORTRAIT_R : 32;
    const src = portrait(person);
    return (
        <span
            className={`relative shrink-0 overflow-hidden rounded-full bg-surface-2 ${person.inCast ? "" : "border border-dashed border-fg-dim"}`}
            style={{ width: px, height: px }}
        >
            {src && <Image unoptimized src={src} alt="" fill sizes={`${px}px`} className="object-cover" />}
        </span>
    );
}

// The other actors of a character, as one line of prose — for the tooltip,
// which is a native SVG <title> and so can hold nothing but text.
const alsoLine = (p: MapPerson) => {
    const others = p.alsoPlayedBy ?? [];
    if (others.length === 0) return "";
    const say = (a: MapActor) => (a.era ? `${a.name} (${ERA_LABEL[a.era]})` : a.name);
    return `\nAlso played by ${others.map(say).join(", ")}`;
};

/**
 * The relationship chart, on its own page.
 *
 * Households in blocks around the leads, the relation to a lead written under
 * each face rather than on the line. Hover a face to see only its links; click
 * a link (or a caption) to read the sentence it was taken from — the chart is
 * read out of text, and the sentence is what lets a reader check it.
 *
 * The filters are the questions a reader has about a chart like this: the
 * compact cut or everyone, which kinds of link, whether to show the twists
 * (on only for a show the reader has finished), the links no sentence
 * backs, and the people MDL's cast does not carry.
 */
export function CharacterMap({ map, completed = false }: { map: CharacterMapData; completed?: boolean }) {
    const [everyone, setEveryone] = useState(true);
    const [types, setTypes] = useState<Set<LinkType>>(() => new Set(TYPES));
    // A show the reader has finished opens with everything on the table: the
    // reveals, and the links no sentence backs — which are mostly what the
    // story is known to do. Anything else keeps both behind their toggles,
    // whatever the site-wide spoiler preference says: a chart is one place
    // where a twist is a caption under a face, read before it is meant to be.
    const [reveals, setReveals] = useState(completed);
    const [inferred, setInferred] = useState(completed);
    const [ghosts, setGhosts] = useState(true);
    const [labels, setLabels] = useState(true);
    // What the panel under the chart is about: one link, or one person and
    // every link they have. A face stays isolated while it is selected.
    const [selected, setSelected] = useState<{ kind: "link"; index: number } | { kind: "person"; id: string } | null>(null);
    const pickLink = (index: number) => setSelected((s) => (s?.kind === "link" && s.index === index ? null : { kind: "link", index }));
    const pickPerson = (id: string) => setSelected((s) => (s?.kind === "person" && s.id === id ? null : { kind: "person", id }));
    const [hover, setHover] = useState<string | null>(null);

    // The chart is looked at through a fixed window and dragged around, not
    // scrolled: it opens on the whole thing, and a reader who wants a corner
    // zooms into it. Nothing but the SVG's viewBox moves.
    const frameRef = useRef<HTMLDivElement>(null);
    const [frame, setFrame] = useState({ w: 1100, h: 760 });
    // x, y: the top-left of the window in chart units; z: chart units per screen pixel, inverted (2 = twice as big)
    const [view, setView] = useState({ x: 0, y: 0, z: 1 });
    const ZMIN = 0.45, ZMAX = 2.2;
    const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

    const layout = useMemo(
        () => layoutCompact(map, { width: W, everyone, types, inferred, ghosts, hideLink: (l) => !reveals && l.reveal }),
        [map, everyone, types, inferred, ghosts, reveals],
    );

    useLayoutEffect(() => {
        const el = frameRef.current;
        if (!el) return;
        const measure = () => setFrame({ w: el.clientWidth, h: Math.min(760, Math.max(420, Math.round(el.clientWidth * 0.62))) });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // The window in chart units is the frame divided by the zoom. It may not
    // leave the chart, and a chart smaller than the window sits centred.
    const clamp = (x: number, y: number, z: number) => {
        const vw = frame.w / z, vh = frame.h / z;
        return {
            x: layout.width <= vw ? (layout.width - vw) / 2 : Math.max(0, Math.min(layout.width - vw, x)),
            y: layout.height <= vh ? (layout.height - vh) / 2 : Math.max(0, Math.min(layout.height - vh, y)),
            z,
        };
    };
    // The whole chart, in the frame. Never past 1: a chart that fits already
    // is drawn at the size it was designed at rather than blown up to fill
    // the room. The charts written so far land between 0.74 and 1, so this
    // is a step back, not a squint — and clamp() does the centring.
    const fit = () =>
        setView(() => {
            const z = Math.max(ZMIN, Math.min(1, frame.w / layout.width, frame.h / layout.height));
            return clamp(0, 0, z);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(fit, [layout, frame.w, frame.h]);

    // Zoom about a point of the frame (the cursor, or its middle for the
    // buttons): the chart point under it stays under it.
    const zoomAt = (factor: number, fx: number, fy: number) =>
        setView((v) => {
            const z = Math.max(ZMIN, Math.min(ZMAX, v.z * factor));
            const px = v.x + fx / v.z, py = v.y + fy / v.z;
            return clamp(px - fx / z, py - fy / z, z);
        });
    // Plain scrolling keeps scrolling the page; Ctrl/⌘ + wheel and a trackpad
    // pinch (which arrives as a wheel with ctrlKey) zoom. A native listener,
    // not React's onWheel: React registers wheel as passive, and a passive
    // listener cannot stop the browser from zooming the whole page too.
    const svgRef = useRef<SVGSVGElement>(null);
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (!e.ctrlKey && !e.metaKey) return;
            e.preventDefault();
            const r = el.getBoundingClientRect();
            zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [frame.w, frame.h, layout]);

    const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
        if (e.button !== 0) return;
        drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
        delete e.currentTarget.dataset.dragged;
    };
    const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.moved && Math.hypot(dx, dy) < 4) return;
        if (!d.moved) {
            // Only now does the SVG take the pointer. Capturing on pointerdown
            // sent the click to the SVG as well, so a link could no longer be
            // clicked; capturing once a drag has begun keeps the drag alive
            // outside the frame without touching plain clicks.
            d.moved = true;
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        setView((v) => clamp(d.vx - dx / v.z, d.vy - dy / v.z, v.z));
    };
    const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
        // A press that became a drag must not also select what it was released on.
        if (drag.current?.moved) e.currentTarget.dataset.dragged = "1";
        drag.current = null;
    };
    const unlessDragged = (fn: () => void) => (e: React.MouseEvent<SVGElement>) => {
        if (e.currentTarget.ownerSVGElement?.dataset.dragged) return;
        fn();
    };

    const counts = useMemo(() => {
        const keep = new Set(everyone ? map.people.map((p) => p.id) : map.compact.people);
        const inCut = map.links.filter((l) => keep.has(l.from) && keep.has(l.to));
        return {
            reveals: inCut.filter((l) => l.reveal && !l.inferred).length,
            inferred: inCut.filter((l) => l.inferred).length,
            ghosts: map.people.filter((p) => keep.has(p.id) && !p.inCast).length,
            byType: Object.fromEntries(TYPES.map((t) => [t, inCut.filter((l) => l.type === t && !l.inferred).length])) as Record<LinkType, number>,
        };
    }, [map, everyone]);

    const byId = useMemo(() => new Map(layout.people.map((p) => [p.id, p])), [layout]);
    const focus = hover ?? (selected?.kind === "person" ? selected.id : null);
    const near = useMemo(() => {
        if (!focus) return null;
        const s = new Set([focus]);
        for (const l of layout.links) {
            if (l.from === focus) s.add(l.to);
            if (l.to === focus) s.add(l.from);
        }
        return s;
    }, [focus, layout]);
    const linkTouches = (l: LaidOutLink, id: string | null) => !!id && (l.from === id || l.to === id);

    // A caption belongs to one link, and under a focus it only speaks if that
    // link touches the face being read. Hovering I Chan leaves "father · I Chan"
    // under Eun Ho and takes away "older brother · Eun Gyeol", which is about
    // somebody else — the same cut the dimming already makes on the lines.
    const linkOf = useMemo(() => new Map(layout.links.map((l) => [l.index, l])), [layout]);
    const captionSpeaks = (linkIndex: number) => {
        if (!focus) return true;
        const l = linkOf.get(linkIndex);
        return !l || linkTouches(l, focus);
    };

    const toggleType = (t: LinkType) =>
        setTypes((prev) => {
            const next = new Set(prev);
            if (!next.delete(t)) next.add(t);
            return next;
        });

    const selectedLink = selected?.kind === "link" ? map.links[selected.index] : null;
    const selectedPerson = selected?.kind === "person" ? (byId.get(selected.id) ?? null) : null;
    const personLinks = selectedPerson ? layout.links.filter((l) => l.from === selectedPerson.id || l.to === selectedPerson.id) : [];
    const halo = "var(--color-surface-1)";
    const textStroke = { paintOrder: "stroke" as const, stroke: halo, strokeWidth: 3, strokeLinejoin: "round" as const };

    return (
        <div className="space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-line-strong bg-surface-1 p-0.5">
                    {([true, false] as const).map((all) => (
                        <button
                            key={String(all)}
                            type="button"
                            onClick={() => {
                                setEveryone(all);
                                setSelected(null);
                            }}
                            aria-pressed={everyone === all}
                            className={`rounded-md px-2 py-1 text-xs transition-all cursor-pointer ${everyone === all ? "bg-surface-3 text-fg" : "text-fg-dim hover:bg-surface-2 hover:text-fg"}`}
                        >
                            {all ? `Everyone · ${map.people.length}` : `Compact · ${map.compact.people.length}`}
                        </button>
                    ))}
                </div>

                <div className="h-4 w-px bg-surface-3" />

                {TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => toggleType(t)} aria-pressed={types.has(t)} className={pill(types.has(t))} disabled={counts.byType[t] === 0}>
                        <span className={`inline-block h-0.5 w-3 rounded ${types.has(t) ? "bg-current " + TYPE_CLASS[t] : "bg-fg-faint"}`} />
                        {TYPE_LABEL[t]}
                        <span className="opacity-50">{counts.byType[t]}</span>
                    </button>
                ))}

                <div className="h-4 w-px bg-surface-3" />

                <button type="button" onClick={() => setReveals((v) => !v)} aria-pressed={reveals} className={pill(reveals)} disabled={counts.reveals === 0}>
                    Reveals <span className="opacity-50">{counts.reveals}</span>
                </button>
                <button type="button" onClick={() => setInferred((v) => !v)} aria-pressed={inferred} className={pill(inferred)} disabled={counts.inferred === 0}>
                    Inferred <span className="opacity-50">{counts.inferred}</span>
                </button>
                <button type="button" onClick={() => setGhosts((v) => !v)} aria-pressed={ghosts} className={pill(ghosts)} disabled={counts.ghosts === 0}>
                    Not in cast <span className="opacity-50">{counts.ghosts}</span>
                </button>
                <button type="button" onClick={() => setLabels((v) => !v)} aria-pressed={labels} className={pill(labels)}>
                    Labels
                </button>
            </div>

            {/* The window onto the chart: drag to move around, the leads in the middle to start. */}
            <div ref={frameRef} className="relative overflow-hidden rounded-xl border border-line-soft bg-surface-1">
                <svg
                    viewBox={`${view.x} ${view.y} ${frame.w / view.z} ${frame.h / view.z}`}
                    width={frame.w}
                    height={frame.h}
                    className="block cursor-grab touch-none select-none active:cursor-grabbing"
                    role="img"
                    aria-label={`Character relationships in ${map.title}`}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    ref={svgRef}
                >
                    <defs>
                        {TYPES.map((t) => (
                            <marker key={t} id={`cm-arrow-${t}`} viewBox="0 -4 8 8" refX={8 + R} refY={0} markerWidth={7} markerHeight={7} orient="auto" className={TYPE_CLASS[t]}>
                                <path d="M0,-4L8,0L0,4Z" fill="currentColor" />
                            </marker>
                        ))}
                        {layout.people.map((p) => (
                            <clipPath key={p.id} id={`cm-clip-${p.id}`}>
                                <circle r={R - 2} />
                            </clipPath>
                        ))}
                    </defs>

                    {/* Blocks: a dashed outline and a name, the way a broadcaster's chart boxes a household */}
                    {layout.blocks.map((b) => (
                        <g key={b.name} className="text-fg-dim">
                            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={14} fill="none" className="stroke-line-soft" strokeDasharray="3 4" />
                            <text x={b.x + 10} y={b.y - 5} fill="currentColor" className="font-mono text-[10px] uppercase tracking-[.08em]">
                                {b.name}
                            </text>
                        </g>
                    ))}

                    {/* Links, under the faces */}
                    {layout.links.map((l) => {
                        const faded = near ? !linkTouches(l, focus) : false;
                        const active = (selected?.kind === "link" && selected.index === l.index) || (selected?.kind === "person" && linkTouches(l, selected.id));
                        return (
                            <g key={l.index} className={TYPE_CLASS[l.type]} style={{ opacity: faded ? 0.08 : l.inferred ? 0.4 : 1, transition: "opacity .15s" }}>
                                <path
                                    d={linkPath(l)}
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth={active ? 3.5 : 2}
                                    strokeLinecap="round"
                                    strokeDasharray={l.reveal ? "6 5" : l.inferred ? "2 4" : undefined}
                                    markerEnd={l.directed ? `url(#cm-arrow-${l.type})` : undefined}
                                />
                                <path d={linkPath(l)} fill="none" stroke="transparent" strokeWidth={14} className="cursor-pointer" onClick={unlessDragged(() => pickLink(l.index))} />
                                {l.onLine && labels && (
                                    <text x={l.lx} y={l.ly} textAnchor="middle" className="pointer-events-none fill-fg-soft text-[10px] font-medium" style={textStroke}>
                                        {l.short}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Faces */}
                    {layout.people.map((p) => {
                        const faded = near ? !near.has(p.id) : false;
                        // Text is centred under the face unless that would run it off the
                        // frame's edge; then it hangs from the face's near side instead.
                        const widest = Math.max(p.name.length * 6.8, actorLine(p).length * 5.7, ...p.captions.map((c) => c.text.length * 5.9));
                        const anchor = p.x - widest / 2 < 8 ? "start" : p.x + widest / 2 > layout.width - 8 ? "end" : "middle";
                        const tx = anchor === "start" ? -R : anchor === "end" ? R : 0;
                        return (
                            <g
                                key={p.id}
                                transform={`translate(${p.x},${p.y})`}
                                style={{ opacity: faded ? 0.18 : 1, transition: "opacity .15s" }}
                                onMouseEnter={() => setHover(p.id)}
                                // Released on leaving the face, not the frame: otherwise the
                                // last face hovered kept the chart dimmed while the pointer
                                // wandered over the lines.
                                onMouseLeave={() => setHover(null)}
                                onClick={unlessDragged(() => pickPerson(p.id))}
                                className="cursor-pointer"
                            >
                                <title>{`${p.name} — ${p.actor}${alsoLine(p)}${p.note ? `\n${p.note}` : ""}${p.inCast ? "" : "\n(not in MDL's cast)"}`}</title>
                                <circle
                                    r={R}
                                    className={p.lead ? "fill-surface-2 stroke-sky-400" : p.inCast ? "fill-surface-2 stroke-line-strong" : "fill-surface-1 stroke-fg-dim"}
                                    strokeWidth={selected?.kind === "person" && selected.id === p.id ? 3.5 : p.lead ? 2.5 : 1.5}
                                    strokeDasharray={p.inCast ? undefined : "4 3"}
                                />
                                {portrait(p) ? (
                                    <image href={portrait(p)!} x={-(R - 2)} y={-(R - 2)} width={2 * (R - 2)} height={2 * (R - 2)} clipPath={`url(#cm-clip-${p.id})`} preserveAspectRatio="xMidYMid slice" />
                                ) : (
                                    <text dy={4} textAnchor="middle" className="fill-fg-faint font-mono text-[11px]">
                                        ?
                                    </text>
                                )}
                                <text x={tx} dy={R + 15} textAnchor={anchor} className="fill-fg text-[12px] font-semibold" style={textStroke}>
                                    {p.name.replace(/ \(.*\)$/, "")}
                                </text>
                                <text x={tx} dy={R + 27} textAnchor={anchor} className="fill-fg-dim font-mono text-[9.5px]" style={textStroke}>
                                    {actorLine(p)}
                                </text>
                                {labels &&
                                    p.captions.map((c, i) => {
                                        const speaks = captionSpeaks(c.linkIndex);
                                        return (
                                            <text
                                                key={i}
                                                x={tx}
                                                dy={R + 41 + i * 12}
                                                textAnchor={anchor}
                                                className={`cursor-pointer text-[10.5px] font-medium ${TYPE_CLASS[c.type]} ${c.reveal ? "italic" : ""}`}
                                                fill="currentColor"
                                                // The lines keep their places while some go quiet:
                                                // captions that slid up to close a gap would make
                                                // the whole chart twitch under the pointer.
                                                style={{ ...textStroke, opacity: speaks ? 1 : 0, transition: "opacity .15s", pointerEvents: speaks ? undefined : "none" }}
                                                onClick={unlessDragged(() => pickLink(c.linkIndex))}
                                            >
                                                {c.text}
                                            </text>
                                        );
                                    })}
                            </g>
                        );
                    })}
                </svg>
                <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-line-strong bg-surface-2/90 backdrop-blur-sm">
                    {(
                        [
                            ["Zoom in", <Plus key="in" className="h-4 w-4" />, () => zoomAt(1.25, frame.w / 2, frame.h / 2), view.z >= ZMAX],
                            ["Zoom out", <Minus key="out" className="h-4 w-4" />, () => zoomAt(0.8, frame.w / 2, frame.h / 2), view.z <= ZMIN],
                            ["Fit the whole chart", <Crosshair key="c" className="h-4 w-4" />, fit, false],
                        ] as const
                    ).map(([title, icon, run, off]) => (
                        <button
                            key={title}
                            type="button"
                            onClick={run}
                            title={title}
                            disabled={off}
                            className="inline-flex h-8 w-8 items-center justify-center text-fg-dim transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-40 cursor-pointer disabled:cursor-default [&+&]:border-t [&+&]:border-line-soft"
                        >
                            {icon}
                        </button>
                    ))}
                </div>
            </div>

            {/* Under the chart: the line styles, and the sentence behind the selected link */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-dim">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-5 border-t-2 border-dashed border-fg-dim" />
                    reveal
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-5 border-t-2 border-dotted border-fg-faint" />
                    inferred, no sentence
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-full border border-dashed border-fg-dim" />
                    not in MDL&apos;s cast
                </span>
                <span className="ml-auto text-fg-faint">drag to move · ⌘/Ctrl + wheel or pinch to zoom · click a face or a link</span>
            </div>

            {selectedLink ? (
                <div className="rounded-xl border border-line-soft bg-surface-1 px-4 py-3 text-sm">
                    {/* The two faces, the way the chart draws them, so the eye finds them
                        back up in the picture without reading. */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Face person={byId.get(selectedLink.from) ?? null} />
                        <span className="font-semibold text-fg">{byId.get(selectedLink.from)?.name ?? selectedLink.from}</span>
                        <span className="text-fg-dim">{selectedLink.directed ? "→" : "↔"}</span>
                        <span className="font-semibold text-fg">{byId.get(selectedLink.to)?.name ?? selectedLink.to}</span>
                        <Face person={byId.get(selectedLink.to) ?? null} />
                        <span className={`ml-1 text-xs font-medium ${TYPE_CLASS[selectedLink.type]}`}>{selectedLink.label}</span>
                    </div>
                    {selectedLink.evidence && !CJK.test(selectedLink.evidence) ? (
                        <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-fg-soft">
                            {selectedLink.evidence}
                            {selectedLink.source && <span className="ml-2 font-mono text-[11px] text-fg-dim">— {selectedLink.source}</span>}
                        </blockquote>
                    ) : selectedLink.evidence ? (
                        <p className="mt-1.5 font-mono text-[11px] text-fg-dim">read from {selectedLink.source ?? "the sources"}</p>
                    ) : (
                        <p className="mt-2 text-xs text-fg-dim">No sentence in the sources says this — it is known from the show, not from the text.</p>
                    )}
                </div>
            ) : selectedPerson ? (
                <div className="rounded-xl border border-line-soft bg-surface-1 px-4 py-3 text-sm">
                    {/* The person, and the same character at another age: one row of
                        portraits at the size the chart draws them, each with the actor
                        and which stretch of the life they cover. The faces are what the
                        reader came down here for — the chart above can only afford one. */}
                    <div className="flex items-start gap-x-5 gap-y-3">
                        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
                            <span className="flex flex-col items-center gap-1.5 text-center">
                                <Face person={selectedPerson} size="lg" />
                                <span className="font-semibold text-fg">{selectedPerson.name}</span>
                                <span className="font-mono text-[11px] text-fg-dim">{selectedPerson.actor}</span>
                            </span>
                            {/* The words that turn a row of strangers into one character:
                                without them the second portrait reads as another person. */}
                            {selectedPerson.alsoPlayedBy && selectedPerson.alsoPlayedBy.length > 0 && (
                                <span className="self-center text-xs text-fg-dim">Also played by</span>
                            )}
                            {(selectedPerson.alsoPlayedBy ?? []).map((a) => (
                                <span key={`${a.name}-${a.era ?? ""}`} className="flex flex-col items-center gap-1.5 text-center">
                                    <Face person={{ image: a.image ?? null, still: a.still, name: a.name, inCast: true }} size="lg" />
                                    {a.era && <span className="text-xs text-fg-soft">{ERA_LABEL[a.era]}</span>}
                                    <span className="font-mono text-[11px] text-fg-dim">{a.name}</span>
                                </span>
                            ))}
                        </div>
                        <span className="ml-auto text-xs text-fg-dim">
                            {personLinks.length} link{personLinks.length === 1 ? "" : "s"}
                        </span>
                    </div>
                    {selectedPerson.note && <p className="mt-2 text-xs text-fg-dim">{selectedPerson.note}</p>}
                    {personLinks.length > 0 && (
                        <ul className="mt-2 divide-y divide-line-soft">
                            {personLinks.map((l) => {
                                const other = byId.get(l.from === selectedPerson.id ? l.to : l.from);
                                if (!other) return null;
                                const outgoing = l.from === selectedPerson.id;
                                return (
                                    <li key={l.index}>
                                        <button
                                            type="button"
                                            onClick={() => pickLink(l.index)}
                                            className="flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 py-2 text-left transition-colors hover:bg-surface-2 cursor-pointer"
                                        >
                                            <span className="w-4 text-center text-fg-dim">{l.directed ? (outgoing ? "→" : "←") : "↔"}</span>
                                            <Face person={other} />
                                            <span className="font-medium text-fg">{other.name}</span>
                                            <span className={`text-xs font-medium ${TYPE_CLASS[l.type]} ${l.reveal ? "italic" : ""}`}>{l.label}</span>
                                            {l.source && <span className="ml-auto font-mono text-[11px] text-fg-faint">{l.source}</span>}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            ) : null}
        </div>
    );
}
