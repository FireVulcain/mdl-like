"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Star } from "lucide-react";
import type { KuryanaEpisodeReview } from "@/lib/kuryana";

const COLLAPSE_THRESHOLD = 300; // characters, or more than 6 newlines

export function EpisodeReviewCard({ review }: { review: KuryanaEpisodeReview }) {
    const [expanded, setExpanded] = useState(false);
    const isLong = review.body.length > COLLAPSE_THRESHOLD || review.body.split("\n").length > 6;

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/3 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 bg-gray-800 flex items-center justify-center">
                        {review.author_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={review.author_avatar} alt={review.author} className="size-full object-cover" />
                        ) : (
                            <span className="text-[10px] font-bold text-gray-500">
                                {review.author.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <a
                            href={review.author_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white hover:text-blue-400 transition-colors truncate block"
                        >
                            {review.author}
                        </a>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{review.date}</span>
                            {review.helpful_count > 0 && (
                                <>
                                    <span>·</span>
                                    <span>{review.helpful_count} found helpful</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {review.rating > 0 && (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/15">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">{review.rating.toFixed(1)}</span>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                {review.headline && (
                    <p className="text-sm font-semibold text-white leading-snug">{review.headline}</p>
                )}
                {review.body && (
                    <p className={`text-sm text-gray-300 leading-relaxed whitespace-pre-line ${!expanded && isLong ? "line-clamp-6" : ""}`}>
                        {review.body}
                    </p>
                )}
            </div>

            {isLong && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="self-start inline-flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                    {expanded ? "Show less" : "Read more"}
                    {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </button>
            )}
        </div>
    );
}
