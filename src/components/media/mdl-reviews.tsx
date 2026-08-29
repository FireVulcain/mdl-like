"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, ChevronDown, ChevronUp, ExternalLink, RefreshCw, TriangleAlert } from "lucide-react";
import { KuryanaReview } from "@/lib/kuryana";
import { loadMoreReviews } from "@/actions/mdl-reviews";
import { mdlUserFromProfileUrl, mdlUserHref } from "@/lib/mdl-user-link";

const TRUNCATE_LENGTH = 280;

/** Past this a first paragraph is prose, not a heading. */
const TITLE_MAX_LENGTH = 120;

const SUB_RATING_KEYS = ["Story", "Acting/Cast", "Music", "Rewatch Value"] as const;

// Returns a stable fingerprint for a page of reviews to detect API wrap-around
function pageFingerprint(reviews: KuryanaReview[]): string {
    return reviews.map((r) => r.reviewer.name).join("|");
}

function ReviewCard({ review }: { review: KuryanaReview }) {
    const [expanded, setExpanded] = useState(false);

    // `review` is a list of paragraphs, not a [title, ...body] tuple: MDL gives
    // some reviews a heading, some a spoiler flag, and some neither. Reading
    // paragraph 0 as the title regardless turned a single-paragraph review into
    // an 800-character bold heading that the truncation never touched, because
    // only the body was ever measured.
    const parts = (review.review ?? []).map((p) => p.trim()).filter(Boolean);

    const hasSpoilerFlag = parts.length > 0 && /^this review may contain spoilers$/i.test(parts[0]);
    const rest = hasSpoilerFlag ? parts.slice(1) : parts;

    // A first paragraph is a heading only when something follows it and it is
    // short enough to read as one.
    const hasTitle = rest.length > 1 && rest[0].length <= TITLE_MAX_LENGTH;
    const title = hasTitle ? rest[0] : "";
    const body = (hasTitle ? rest.slice(1) : rest).join("\n\n").trim();

    const isLong = body.length > TRUNCATE_LENGTH;
    const displayBody = isLong && !expanded ? `${body.slice(0, TRUNCATE_LENGTH).trimEnd()}…` : body;

    const helpfulMatch = review.reviewer.info?.match(/^(\d+)/);
    const helpfulCount = helpfulMatch ? parseInt(helpfulMatch[1]) : null;

    const subRatings = SUB_RATING_KEYS.filter((k) => review.ratings?.[k] != null);

    // The byline used to leave the site. It now opens the reviewer's list here,
    // and only falls back to MDL when the profile link is unreadable.
    const reviewerId = mdlUserFromProfileUrl(review.reviewer.user_link);
    const listHref = reviewerId ? mdlUserHref(reviewerId, review.reviewer.name) : null;

    const avatar = review.reviewer.user_image ? (
        // Plain img — avoids Next.js proxy which 403s on MDL letter-avatars and GIFs
        // eslint-disable-next-line @next/next/no-img-element
        <img src={review.reviewer.user_image} alt={review.reviewer.name} className="size-full object-cover" />
    ) : (
        <span className="text-xs font-bold text-fg-dim">{review.reviewer.name.slice(0, 2).toUpperCase()}</span>
    );
    const avatarClass =
        "size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-line-strong bg-surface-3 flex items-center justify-center";

    return (
        <div className="flex flex-col gap-3 py-4 transition-colors">
            {/* Reviewer row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {listHref ? (
                        <Link
                            href={listHref}
                            title={`See ${review.reviewer.name}'s list`}
                            className={`${avatarClass} hover:ring-2 hover:ring-sky-500/50 transition-all`}
                        >
                            {avatar}
                        </Link>
                    ) : (
                        <div className={avatarClass}>{avatar}</div>
                    )}
                    <div className="min-w-0">
                        {listHref ? (
                            <Link
                                href={listHref}
                                className="text-sm font-medium text-fg hover:text-sky-400 transition-colors truncate block"
                            >
                                {review.reviewer.name}
                            </Link>
                        ) : (
                            <a
                                href={review.reviewer.user_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-fg hover:text-blue-400 transition-colors truncate block"
                            >
                                {review.reviewer.name}
                            </a>
                        )}
                        {helpfulCount != null && (
                            <p className="text-xs text-fg-dim truncate">
                                {helpfulCount.toLocaleString()} found this helpful
                            </p>
                        )}
                    </div>
                </div>

                {/* Overall rating */}
                {review.ratings?.overall != null && (
                    <div className="flex items-center gap-1 shrink-0">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-semibold text-yellow-400">
                            {review.ratings.overall.toFixed(1)}
                        </span>
                    </div>
                )}
            </div>

            {/* Review body */}
            <div className="space-y-1">
                {hasSpoilerFlag && (
                    <p className="flex items-center gap-1.5 text-xs text-rose-400/90">
                        <TriangleAlert className="size-3 shrink-0" />
                        May contain spoilers
                    </p>
                )}
                {title && (
                    <p className="text-sm font-semibold text-fg leading-snug">{title}</p>
                )}
                {body && (
                    <p className="text-sm text-fg-soft leading-relaxed whitespace-pre-line">{displayBody}</p>
                )}
                {isLong && (
                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="cursor-pointer flex items-center gap-0.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
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
                            className="flex items-center gap-1 text-xs text-fg-muted"
                        >
                            <span className="text-fg-dim">{key}</span>
                            <span className="font-medium text-fg-muted">{review.ratings?.[key]!.toFixed(1)}</span>
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
                <h3 className="font-display text-lg font-semibold text-fg">Reviews</h3>
                <a
                    href={mdlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg transition-colors"
                >
                    All reviews <ExternalLink className="size-3" />
                </a>
            </div>

            {/* A hairline between reviews rather than a box around each: they are
                a stack of the same thing, and the rule is enough to separate them. */}
            <div className="flex flex-col divide-y divide-line">
                {displayedReviews.map((review, i) => (
                    <ReviewCard key={i} review={review} />
                ))}
            </div>

            {previewLimit && allReviewsHref ? (
                <a
                    href={allReviewsHref}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-fg-muted hover:text-fg transition-colors"
                >
                    View all reviews <ChevronDown className="size-4" />
                </a>
            ) : !exhausted && (
                <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
