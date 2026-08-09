"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion, animate } from "framer-motion";
import { Bookmark, ImageOff, Star, UserRound } from "lucide-react";
import { LinkToTmdbButton } from "@/components/media/link-to-tmdb-button";
import type { RowExtras } from "@/lib/row-extras";

export type SpotlightItem = {
    id: string;
    title: string;
    poster: string | null;
    year?: string;
    rating: number;
    synopsis?: string;
    href: string;
    bookmarked: boolean;
    unlinkedSlug?: string;
    // Replaces the year when a premiere date is known (Coming Soon)
    premiere?: string;
    extras?: RowExtras | null;
};

// Long enough that crossing the row on the way somewhere else never triggers it,
// short enough that a deliberate pause is answered before it feels ignored.
const PROMOTE_AFTER_MS = 650;

// One curve and one duration for both halves of the move — see the comment where
// the row is scrolled for why they cannot differ.
const TRAVEL_S = 0.55;
const TRAVEL_EASE = [0.32, 0.72, 0, 1] as const;

function BookmarkBadge({ className }: { className: string }) {
    return (
        <div className={className}>
            <span className="flex items-center justify-center h-6 w-6 rounded-md bg-emerald-500/90 backdrop-blur-sm">
                <Bookmark className="h-3.5 w-3.5 text-white fill-current" />
            </span>
        </div>
    );
}

function MdlRating({ rating, className = "" }: { rating: number; className?: string }) {
    if (rating <= 0) return null;
    return (
        <span className={`flex items-center gap-0.5 text-sky-400 font-semibold ${className}`}>
            <Star className="h-3 w-3 fill-current" />
            {rating.toFixed(1)}
        </span>
    );
}

/**
 * The promoted card. Its poster carries a layoutId shared with the small cell
 * the same show occupies when it isn't the lead — that pair is what makes the
 * artwork travel and resize instead of appearing in two places.
 */
function SpotlightLead({
    item,
    kicker,
    kickerClass,
    duration,
}: {
    item: SpotlightItem;
    kicker: string;
    kickerClass: string;
    duration: number;
}) {
    const extras = item.extras;
    return (
        // The card is not a link — a link laid underneath it is. An <a> inside an
        // <a> is invalid and the browser silently unnests it, so the cast faces
        // could never be links of their own that way. Inverted, the card's link is
        // a sibling covering the whole box, the content sits above it but lets
        // clicks fall through, and anything that needs its own destination takes
        // its events back. No z-index involved: paint order already does it.
        <div className="group relative shrink-0 w-85 sm:w-100 md:w-140 lg:w-160 mr-2 md:mr-4 whitespace-normal">
            <Link href={item.href} aria-label={item.title} className="absolute inset-0" />
            <div className="relative flex items-center gap-4 md:gap-5 pointer-events-none">
                {/* The key matters as much as the layoutId. Without it this node
                    survives the swap and merely changes which layoutId it claims,
                    so for one commit two nodes claim the same id — the cell being
                    unmounted and this one — and framer-motion hides one of them.
                    Keyed, it unmounts and remounts like the cells do, which is the
                    one-leaves-one-arrives pair a shared layout animation expects.

                    Definite height, not h-full, for a second reason: a percentage
                    height resolves against a parent the row stretches, and it
                    collapses to zero while the element is measured out of flow. */}
                <motion.div
                    key={item.id}
                    layoutId={`spotlight-poster-${item.id}`}
                    transition={{ duration, ease: [...TRAVEL_EASE] }}
                    className="relative h-64 sm:h-72 md:h-80 aspect-2/3 rounded-lg overflow-hidden shrink-0 bg-white/5"
                >
                    {item.poster ? (
                        <Image
                            unoptimized
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="200px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                            <ImageOff className="h-5 w-5" />
                        </div>
                    )}

                    {item.bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                    {item.unlinkedSlug && (
                        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                            <LinkToTmdbButton mdlSlug={item.unlinkedSlug} defaultQuery={item.title} compact />
                        </div>
                    )}
                </motion.div>

                {/* The text is replaced rather than moved: it belongs to whichever
                    show holds the slot, and there is no counterpart to travel to. */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: duration * 0.5 }}
                        className="flex-1 min-w-0 space-y-1.5 md:space-y-2"
                    >
                        <p className={`text-xs font-bold tracking-wide ${kickerClass}`}>{kicker}</p>
                        <h4 className="text-lg font-extrabold text-white leading-tight line-clamp-3 group-hover:text-sky-200 transition-colors">
                            {item.title}
                        </h4>
                        <div className="flex items-center gap-2.5 text-xs text-white/60">
                            {item.premiere ? <span>{item.premiere}</span> : item.year ? <span>{item.year}</span> : null}
                            <MdlRating rating={item.rating} />
                            {extras?.mdlRanking ? (
                                <span className="text-sky-300/60 font-medium">MDL #{extras.mdlRanking}</span>
                            ) : null}
                        </div>
                        {extras && extras.genres.length > 0 && (
                            <p className="text-xs text-white/50">{extras.genres.join(" · ")}</p>
                        )}
                        {item.synopsis && (
                            <p className="hidden md:line-clamp-4 text-xs text-white/50 leading-relaxed">{item.synopsis}</p>
                        )}
                        {extras && extras.cast.length > 0 && (
                            <div className="hidden md:flex items-center gap-2.5 pt-1">
                                {/* Faces take their events back from the card so each
                                    one can lead to its own actor. The overlap means a
                                    later avatar covers the previous one's right edge,
                                    so each is raised over the one before it — the
                                    visible part of a face is the part you can click. */}
                                <div className="flex -space-x-2 pointer-events-auto">
                                    {extras.cast.map((c, i) => {
                                        const face = c.profileImage ? (
                                            <Image
                                                unoptimized
                                                src={c.profileImage}
                                                alt={c.name}
                                                width={28}
                                                height={28}
                                                className="h-7 w-7 rounded-full object-cover ring-2 ring-page transition-transform group-hover/face:scale-110"
                                            />
                                        ) : (
                                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 ring-2 ring-page transition-transform group-hover/face:scale-110">
                                                <UserRound className="h-3.5 w-3.5 text-gray-400" />
                                            </span>
                                        );
                                        const style = { zIndex: i };
                                        return c.href ? (
                                            <Link
                                                key={c.name}
                                                href={c.href}
                                                title={c.name}
                                                style={style}
                                                className="group/face relative rounded-full"
                                            >
                                                {face}
                                            </Link>
                                        ) : (
                                            <span key={c.name} title={c.name} style={style} className="relative">
                                                {face}
                                            </span>
                                        );
                                    })}
                                </div>
                                <span className="text-xs text-white/50 truncate">
                                    {extras.cast.map((c) => c.name).join(" · ")}
                                </span>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

/** A show waiting its turn. Same stacked composition as the airing row. */
function SpotlightCell({
    item,
    duration,
    onArm,
    onDisarm,
}: {
    item: SpotlightItem;
    duration: number;
    onArm: () => void;
    onDisarm: () => void;
}) {
    return (
        <Link
            href={item.href}
            className="group shrink-0 w-32 sm:w-40 md:w-44 whitespace-normal"
            onMouseEnter={onArm}
            onMouseLeave={onDisarm}
        >
            {/* Height derived from a definite width, for the same reason as the
                lead's — both boxes must be measurable on their own. Same 2:3 ratio
                on both sides, so the travel between them is a plain uniform scale
                with no distortion to correct. */}
            <motion.div
                layoutId={`spotlight-poster-${item.id}`}
                transition={{ duration, ease: [...TRAVEL_EASE] }}
                className="relative aspect-2/3 w-32 sm:w-40 md:w-44 rounded-lg overflow-hidden bg-white/5"
            >
                {item.poster ? (
                    <Image
                        unoptimized
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="176px"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                        <ImageOff className="h-4 w-4" />
                    </div>
                )}

                {item.bookmarked && <BookmarkBadge className="absolute bottom-2 left-2" />}
                {item.unlinkedSlug && (
                    // Reaching for this button calls the promotion off. It only
                    // appears once the card is hovered, so by the time it is worth
                    // aiming at, the timer has been running for most of its delay —
                    // and a promotion would carry the button away mid-gesture.
                    // Leaving it re-arms nothing: the pointer never left the card,
                    // so no mouseenter fires, and the promotion stays cancelled
                    // until the card is entered afresh.
                    <div
                        onMouseEnter={onDisarm}
                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <LinkToTmdbButton mdlSlug={item.unlinkedSlug} defaultQuery={item.title} compact />
                    </div>
                )}
            </motion.div>

            <div className="pt-2 space-y-0.5">
                <h4 className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-sky-200 transition-colors">
                    {item.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-white/60">
                    {item.premiere ? <span>{item.premiere}</span> : item.year ? <span>{item.year}</span> : null}
                    {(item.premiere || item.year) && item.rating > 0 && <span className="text-white/30">·</span>}
                    <MdlRating rating={item.rating} />
                </div>
            </div>
        </Link>
    );
}

/**
 * A spotlight row where any card can take the big slot.
 *
 * Nothing is reordered. The lead slot and the hovered card's slot trade their
 * *contents*, so both keep their size and position and every other card stays
 * exactly where it was — which is what keeps the row from shifting under the
 * cursor and leaves drag-to-scroll untouched. The two posters share a layoutId,
 * so the artwork travels and resizes between the two slots rather than
 * disappearing from one and appearing in the other.
 */
export function SpotlightRow({
    items,
    kicker,
    kickerClass,
}: {
    items: SpotlightItem[];
    kicker: string;
    kickerClass: string;
}) {
    // slots[i] is the index into `items` currently sitting in slot i
    const [slots, setSlots] = useState<number[]>(() => items.map((_, i) => i));
    const rootRef = useRef<HTMLDivElement>(null);
    const timer = useRef<number>(0);
    const pointer = useRef({ x: 0, y: 0 });
    // Where the pointer was when the last promotion landed. Until it has actually
    // moved away from there, no hover counts.
    //
    // A promotion changes what sits under a cursor that never moved — twice over.
    // The demoted card is a freshly mounted node, so the browser fires mouseenter
    // at it; and the row scrolls back to the start, sliding a different card under
    // the same point. Either one restarts the timer and promotes something nobody
    // asked for. Requiring real movement covers both without knowing about either.
    const frozenAt = useRef<{ x: number; y: number } | null>(null);
    // Set when a promotion is about to commit, read by the layout effect below
    const scrollPending = useRef(false);
    const reduce = useReducedMotion();
    const duration = reduce ? 0 : TRAVEL_S;

    const disarm = useCallback(() => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = 0;
    }, []);

    useEffect(() => disarm, [disarm]);

    const trackPointer = useCallback((e: React.PointerEvent) => {
        pointer.current = { x: e.clientX, y: e.clientY };
        const frozen = frozenAt.current;
        if (frozen && (Math.abs(e.clientX - frozen.x) > 4 || Math.abs(e.clientY - frozen.y) > 4)) {
            frozenAt.current = null;
        }
    }, []);

    const arm = useCallback(
        (slot: number) => {
            disarm();
            if (frozenAt.current) return;

            timer.current = window.setTimeout(() => {
                // DragScroll flags the row while the pointer is panning it. Promoting
                // mid-drag would swap two cards out from under a moving cursor.
                if (rootRef.current?.closest("[data-dragging]")) return;
                frozenAt.current = { ...pointer.current };
                scrollPending.current = true;
                setSlots((prev) => {
                    const next = [...prev];
                    [next[0], next[slot]] = [next[slot], next[0]];
                    return next;
                });
            }, PROMOTE_AFTER_MS);
        },
        [disarm],
    );

    // The big slot is pinned to the start of the row, so promoting from deep in
    // the scroll would play the whole animation off-screen and leave the demoted
    // card as the only thing you see. Bring the row back, so the card you asked
    // for is the one you end up looking at.
    //
    // Two things make this delicate, and both were measured rather than guessed.
    //
    // The curve and duration must match the poster's flight exactly. Framer-motion
    // measures the destination at swap time, with the row still scrolled, so it
    // aims far off-screen and the scroll is what carries it back. With
    // scrollTo({behavior:"smooth"}) the two had different durations and easings:
    // promoting from the far end of a row, the poster overshot by 1225px and spent
    // 400ms entirely out of view before drifting back in.
    //
    // And they must *start* together, which is why this is a layout effect rather
    // than a line in the timer above. Started from the timer, the scroll begins on
    // the next frame while the layout animation waits for React to commit — 80ms
    // in dev — and the poster lurched 181px the wrong way before settling. A
    // layout effect runs after the children's, so framer-motion has already
    // measured and started by the time this does.
    useLayoutEffect(() => {
        if (!scrollPending.current) return;
        scrollPending.current = false;

        const viewport = rootRef.current?.closest<HTMLElement>("[data-radix-scroll-area-viewport]");
        if (!viewport || viewport.scrollLeft <= 0) return;

        if (reduce) {
            viewport.scrollLeft = 0;
            return;
        }
        const controls = animate(viewport.scrollLeft, 0, {
            duration: TRAVEL_S,
            ease: [...TRAVEL_EASE],
            onUpdate: (v) => {
                viewport.scrollLeft = v;
            },
        });
        return () => controls.stop();
    }, [slots, reduce]);

    if (items.length === 0) return null;

    return (
        <div
            ref={rootRef}
            className="flex gap-4 md:gap-6 py-3 md:py-4"
            onPointerMove={trackPointer}
            // A press means the user is about to drag or click, never to promote
            onPointerDownCapture={disarm}
            onMouseLeave={() => {
                disarm();
                frozenAt.current = null;
            }}
        >
            <SpotlightLead
                item={items[slots[0]]}
                kicker={kicker}
                kickerClass={kickerClass}
                duration={duration}
            />
            {slots.slice(1).map((itemIndex, i) => (
                <SpotlightCell
                    key={items[itemIndex].id}
                    item={items[itemIndex]}
                    duration={duration}
                    onArm={() => arm(i + 1)}
                    onDisarm={disarm}
                />
            ))}
        </div>
    );
}
