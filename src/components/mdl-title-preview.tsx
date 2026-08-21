"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getMdlPreview, type MdlPreview } from "@/actions/mdl-preview";
import { MetaLinkList, GENRE_LIST } from "@/components/media/meta-link-list";

/**
 * Answers kept for the life of the page, keyed by slug.
 *
 * Module scope rather than component state: the point is that hovering the same
 * title twice, or two rows for the same show, costs one request. The server side
 * caches too, so this mostly saves the round trip rather than the scrape — which
 * is still the difference between instant and a blink.
 */
const answers = new Map<string, MdlPreview | null>();

/** Long enough that a pointer crossing the list on its way elsewhere never fires one. */
const OPEN_DELAY_MS = 400;

function Line({ label }: { label: string }) {
    return <div className="h-2.5 rounded bg-white/8 animate-pulse" style={{ width: label }} />;
}

function Body({ data }: { data: MdlPreview }) {
    return (
        <div className="flex gap-3">
            {data.poster && (
                <Image
                    unoptimized
                    src={data.poster}
                    alt=""
                    width={80}
                    height={116}
                    className="w-20 h-29 shrink-0 rounded object-cover bg-white/5"
                />
            )}

            <div className="min-w-0 flex-1 space-y-2">
                <div>
                    <p className="text-sm font-semibold text-white leading-snug">
                        {data.title}
                        {data.year && <span className="ml-1.5 font-normal text-gray-500">{data.year}</span>}
                    </p>
                    {(data.nativeTitle || data.kind) && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {[data.nativeTitle, data.kind].filter(Boolean).join(" · ")}
                        </p>
                    )}
                </div>

                {/* Sky, because this is MyDramaList's own rating — the amber score
                    in the row is the member's. Two numbers, two meanings, and the
                    hue is what keeps them apart at a glance. */}
                {(data.rating || data.ranked || data.episodes) && (
                    <div className="flex items-center gap-3 text-xs">
                        {data.rating && (
                            <span className="flex items-center gap-1 font-medium text-sky-400">
                                <Star className="size-3 fill-sky-400" />
                                {data.rating.toFixed(1)}
                            </span>
                        )}
                        {data.ranked && <span className="text-gray-500">{data.ranked}</span>}
                        {data.episodes && <span className="text-gray-500">{data.episodes} ep</span>}
                    </div>
                )}

                {data.synopsis && (
                    <p className="text-xs leading-relaxed text-gray-400 line-clamp-4">{data.synopsis}</p>
                )}

                {/* The same component and the same destination the media pages
                    use, so a genre goes to the same place wherever it is read.
                    Sized down: GENRE_LIST runs a size up because it sits under a
                    heading, and here it sits under a synopsis. */}
                {data.genres.length > 0 && (
                    <MetaLinkList
                        {...GENRE_LIST}
                        className="text-xs"
                        items={data.genres.map((g) => ({
                            key: g,
                            label: g,
                            href: `/dramas?genre=${encodeURIComponent(g)}`,
                        }))}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * MDL's own hover card, rebuilt on our data.
 *
 * Their v1 list has no artwork in the markup, so they fetch a title's details
 * when you hover it. This does the same through our scraper, and for the same
 * reason: a list of five hundred names is unreadable without something to
 * recognise, and fetching five hundred posters up front to fix that would be
 * worse than fetching the one being pointed at.
 *
 * The request waits for the tooltip to actually open, so it follows Radix's
 * delay rather than the pointer.
 */
export function MdlTitlePreview({ slug, children }: { slug: string; children: React.ReactNode }) {
    const [data, setData] = useState<MdlPreview | null | undefined>(() => answers.get(slug));

    const load = async (open: boolean) => {
        if (!open || answers.has(slug)) return;
        try {
            const found = await getMdlPreview(slug);
            answers.set(slug, found);
            setData(found);
        } catch {
            // A failed lookup is remembered too — a title MDL will not answer for
            // should not be asked about again on every pass of the mouse.
            answers.set(slug, null);
            setData(null);
        }
    };

    return (
        <Tooltip delayDuration={OPEN_DELAY_MS} onOpenChange={load}>
            <TooltipTrigger asChild>{children}</TooltipTrigger>
            <TooltipContent
                side="right"
                align="center"
                sideOffset={10}
                collisionPadding={12}
                className="w-96 max-w-[calc(100vw-2rem)] rounded-lg border-white/10 bg-gray-900 p-3 text-sm shadow-xl shadow-black/50"
            >
                {/* MDL draws one too, and it earns its place here: the card is
                    wide enough to float free of the row it belongs to. */}
                <TooltipArrow width={12} height={6} className="fill-gray-900" />
                {data === undefined ? (
                    <div className="flex gap-3">
                        <div className="w-20 h-29 shrink-0 rounded bg-white/5 animate-pulse" />
                        <div className="flex-1 space-y-2 pt-1">
                            <Line label="70%" />
                            <Line label="40%" />
                            <Line label="100%" />
                            <Line label="90%" />
                            <Line label="60%" />
                        </div>
                    </div>
                ) : data === null ? (
                    <p className="text-xs text-gray-500">MyDramaList didn&rsquo;t answer for this title.</p>
                ) : (
                    <Body data={data} />
                )}
            </TooltipContent>
        </Tooltip>
    );
}
