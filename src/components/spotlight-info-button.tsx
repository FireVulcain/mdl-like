"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Info, Star, UserRound } from "lucide-react";
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCardExtras } from "@/actions/row-extras";
import type { RowExtras } from "@/lib/row-extras";

/** Answers kept for the life of the page, keyed by slug — one request per show. */
const answers = new Map<string, RowExtras | null>();

function Line({ width }: { width: string }) {
    return <div className="h-2.5 rounded bg-surface-3 animate-pulse" style={{ width }} />;
}

/**
 * The small "i" on a spotlight card, and the card it opens.
 *
 * The row used to promote a card to the lead after a long hover, which showed
 * the same thing but moved the row around under a pointer that only paused. A
 * click is a request, a pause is not — so this waits to be asked, and answers
 * in place: nothing in the row moves.
 *
 * The button sits inside the card's link, so its click has to be kept from the
 * link. Radix skips its own toggle once a handler calls preventDefault, so the
 * open state is driven here rather than left to the trigger.
 */
export function SpotlightInfoButton({
    slug,
    title,
    year,
    premiere,
    rating,
    synopsis,
}: {
    slug: string;
    title: string;
    year?: string;
    premiere?: string;
    rating: number;
    synopsis?: string;
}) {
    const [open, setOpen] = useState(false);
    const [extras, setExtras] = useState<RowExtras | null | undefined>(() => answers.get(slug));

    const toggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !open;
        setOpen(next);
        if (!next || answers.has(slug)) return;
        try {
            const found = await getCardExtras(slug);
            answers.set(slug, found);
            setExtras(found);
        } catch {
            answers.set(slug, null);
            setExtras(null);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={`About ${title}`}
                    // Always there on touch screens, where nothing can be hovered;
                    // on a pointer device it waits for the card to be hovered, like
                    // the link button beside it — shown at rest it crowded the
                    // poster. Kept visible while open, or the popover would appear
                    // to hang off nothing.
                    className={`cursor-pointer flex items-center justify-center h-6 w-6 rounded-md bg-black/70 ring-1 ring-white/15 backdrop-blur-sm text-white/80 hover:text-sky-400 hover:bg-sky-500/20 transition-all md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 ${open ? "md:opacity-100 text-sky-400" : ""}`}
                >
                    <Info className="h-3.5 w-3.5" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                collisionPadding={12}
                className="w-80 max-w-[calc(100vw-2rem)] whitespace-normal"
                // The content is portaled, but React events still climb the tree
                // to the card's link — a click on a face would open the drama too.
                onClick={(e) => e.stopPropagation()}
            >
                <PopoverArrow width={12} height={6} className="fill-panel" />
                <div className="space-y-2">
                    <div>
                        <p className="text-sm font-semibold text-fg leading-snug">{title}</p>
                        <div className="flex items-center gap-2 text-xs text-fg-muted mt-0.5">
                            {premiere ? <span>{premiere}</span> : year ? <span>{year}</span> : null}
                            {rating > 0 && (
                                <span className="flex items-center gap-0.5 text-sky-400 font-semibold">
                                    <Star className="h-3 w-3 fill-current" />
                                    {rating.toFixed(1)}
                                </span>
                            )}
                            {extras?.mdlRanking ? (
                                <span className="text-sky-300/60 font-medium">MDL #{extras.mdlRanking}</span>
                            ) : null}
                        </div>
                    </div>

                    {extras === undefined ? (
                        <Line width="60%" />
                    ) : extras && extras.genres.length > 0 ? (
                        <p className="text-[11px] text-fg-dim">{extras.genres.join(" · ")}</p>
                    ) : null}

                    {synopsis ? (
                        <p className="text-xs leading-relaxed text-fg-muted line-clamp-6">{synopsis}</p>
                    ) : (
                        <p className="text-xs text-fg-dim">No synopsis for this title yet.</p>
                    )}

                    {extras === undefined ? (
                        <div className="flex items-center gap-2.5 pt-1">
                            <div className="flex -space-x-2">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-7 w-7 rounded-full bg-surface-3 ring-2 ring-panel animate-pulse" />
                                ))}
                            </div>
                            <Line width="50%" />
                        </div>
                    ) : extras && extras.cast.length > 0 ? (
                        <div className="flex items-center gap-2.5 pt-1">
                            <div className="flex -space-x-2">
                                {extras.cast.map((c, i) => {
                                    const face = c.profileImage ? (
                                        <Image
                                            unoptimized
                                            src={c.profileImage}
                                            alt={c.name}
                                            width={28}
                                            height={28}
                                            className="h-7 w-7 rounded-full object-cover ring-2 ring-panel transition-transform group-hover/face:scale-110"
                                        />
                                    ) : (
                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-4 ring-2 ring-panel transition-transform group-hover/face:scale-110">
                                            <UserRound className="h-3.5 w-3.5 text-fg-muted" />
                                        </span>
                                    );
                                    const style = { zIndex: i };
                                    return c.href ? (
                                        <Link key={c.name} href={c.href} title={c.name} style={style} className="group/face relative rounded-full">
                                            {face}
                                        </Link>
                                    ) : (
                                        <span key={c.name} title={c.name} style={style} className="relative">
                                            {face}
                                        </span>
                                    );
                                })}
                            </div>
                            <span className="text-xs text-fg-dim truncate">{extras.cast.map((c) => c.name).join(" · ")}</span>
                        </div>
                    ) : null}
                </div>
            </PopoverContent>
        </Popover>
    );
}
