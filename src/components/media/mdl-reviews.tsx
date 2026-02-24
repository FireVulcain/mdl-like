"use client";

import { useState } from "react";
import { Star, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from "lucide-react";
import { KuryanaReview } from "@/lib/kuryana";
import { loadMoreReviews } from "@/actions/mdl-reviews";

const TRUNCATE_LENGTH = 280;

const SUB_RATING_KEYS = ["Story", "Acting/Cast", "Music", "Rewatch Value"] as const;

// Returns a stable fingerprint for a page of reviews to detect API wrap-around
function pageFingerprint(reviews: KuryanaReview[]): string {
    return reviews.map((r) => r.reviewer.name).join("|");
}

function ReviewCard({ review }: { review: KuryanaReview }) {
    const [expanded, setExpanded] = useState(false);

    const parts = review.review ?? [];
    const title = parts[0] ?? "";
    const body = parts.slice(1).join("\n\n").trim();
    const isLong = body.length > TRUNCATE_LENGTH;
    const displayBody = isLong && !expanded ? `${body.slice(0, TRUNCATE_LENGTH).trimEnd()}…` : body;

    const helpfulMatch = review.reviewer.info?.match(/^(\d+)/);
    const helpfulCount = helpfulMatch ? parseInt(helpfulMatch[1]) : null;

    const subRatings = SUB_RATING_KEYS.filter((k) => review.ratings?.[k] != null);

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/3 p-4 hover:bg-white/[0.04] transition-colors">
            {/* Reviewer row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Plain img — avoids Next.js proxy which 403s on MDL letter-avatars and GIFs */}
                    <div className="size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-white/10 bg-gray-800 flex items-center justify-center">
                        {review.reviewer.user_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={review.reviewer.user_image}
                                alt={review.reviewer.name}
                                className="size-full object-cover"
                            />
                        ) : (
                            <span className="text-[10px] font-bold text-gray-500">
                                {review.reviewer.name.slice(0, 2).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="min-w-0">
                        <a
                            href={review.reviewer.user_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-white hover:text-blue-400 transition-colors truncate block"
                        >
                            {review.reviewer.name}
                        </a>
                        {helpfulCount != null && (
                            <p className="text-xs text-gray-500 truncate">
                                {helpfulCount.toLocaleString()} found this helpful
                            </p>
                        )}
                    </div>
                </div>

                {/* Overall rating */}
                {review.ratings?.overall != null && (
                    <div className="flex items-center gap-1 shrink-0 px-2 py-1 rounded-lg bg-yellow-400/10 border border-yellow-400/15">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">
                            {review.ratings.overall.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>

            {/* Review body */}
            <div className="space-y-1">
                {title && (
                    <p className="text-sm font-semibold text-white leading-snug">{title}</p>
                )}
                {body && (
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{displayBody}</p>
                )}
                {isLong && (
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="flex items-center gap-0.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        {expanded ? <>Show less <ChevronUp className="size-3" /></> : <>Show more <ChevronDown className="size-3" /></>}
                    </button>
                )}
            </div>

            {/* Sub-ratings */}
            {subRatings.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {subRatings.map((key) => (
                        <span
                            key={key}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/8 text-xs text-gray-400"
                        >
                            <span className="text-gray-500">{key}</span>
                            <span className="font-medium text-white/70">{review.ratings?.[key]!.toFixed(1)}</span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

interface MdlReviewsProps {
    initialReviews: KuryanaReview[];
    mdlSlug: string;
    mdlLink: string;
    /** When set, caps displayed reviews and shows a link instead of load-more */
    previewLimit?: number;
    /** Link to the full reviews page (used with previewLimit) */
    allReviewsHref?: string;
}

export function MdlReviews({ initialReviews, mdlSlug, mdlLink, previewLimit, allReviewsHref }: MdlReviewsProps) {
    const [reviews, setReviews] = useState(initialReviews);
    const displayedReviews = previewLimit ? reviews.slice(0, previewLimit) : reviews;
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [exhausted, setExhausted] = useState(false);
    // Track fingerprint of last loaded batch to detect API wrap-around
    const [lastFingerprint, setLastFingerprint] = useState(() => pageFingerprint(initialReviews));

    if (reviews.length === 0) return null;

    async function handleLoadMore() {
        setLoading(true);
        try {
            const next = await loadMoreReviews(mdlSlug, page + 1);
            if (next.length === 0) {
                setExhausted(true);
                return;
            }
            // API wraps around at the last page — same reviews as before means we're done
            const fingerprint = pageFingerprint(next);
            if (fingerprint === lastFingerprint) {
                setExhausted(true);
                return;
            }
            setLastFingerprint(fingerprint);
            setReviews((prev) => [...prev, ...next]);
            setPage((p) => p + 1);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Reviews</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                        via MDL
                    </span>
                </div>
                <a
                    href={mdlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                    All reviews <ExternalLink className="size-3" />
                </a>
            </div>

            <div className="flex flex-col gap-3">
                {displayedReviews.map((review, i) => (
                    <ReviewCard key={i} review={review} />
                ))}
            </div>

            {previewLimit && allReviewsHref ? (
                <a
                    href={allReviewsHref}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                    View all reviews <ChevronDown className="size-4" />
                </a>
            ) : !exhausted && (
                <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <><RefreshCw className="size-4 animate-spin" /> Loading…</>
                    ) : (
                        <>Load more reviews <ChevronDown className="size-4" /></>
                    )}
                </button>
            )}
        </div>
    );
}
