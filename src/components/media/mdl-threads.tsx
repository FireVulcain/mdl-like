"use client";

import { useState } from "react";
import { Heart, ChevronDown, RefreshCw, MessageSquare } from "lucide-react";
import { MdlComment } from "@/lib/kuryana";
import { loadMoreComments } from "@/actions/mdl-threads";

type CommentNode = MdlComment & { children: CommentNode[] };

function buildTree(comments: MdlComment[]): CommentNode[] {
    const map = new Map<number, CommentNode>();
    const roots: CommentNode[] = [];

    for (const c of comments) {
        map.set(c.id, { ...c, children: [] });
    }

    for (const c of comments) {
        const node = map.get(c.id)!;
        if (c.parent_id && map.has(c.parent_id)) {
            map.get(c.parent_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
}

const AUTHOR_COLORS = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-sky-500",
    "bg-pink-500",
    "bg-teal-500",
];

function getAuthorColor(name: string): string {
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return AUTHOR_COLORS[hash % AUTHOR_COLORS.length];
}

function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const MESSAGE_TRUNCATE = 280;

function CommentCard({ comment, nested = false }: { comment: CommentNode; nested?: boolean }) {
    const [revealed, setRevealed] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [showReplies, setShowReplies] = useState(true);

    if (comment.deleted) {
        return (
            <div className="flex gap-2.5">
                <div className={`${nested ? "size-6" : "size-7"} shrink-0 rounded-full bg-white/5`} />
                <p className="text-xs text-gray-600 italic pt-1.5">[Comment removed]</p>
            </div>
        );
    }

    const rawText = comment.raw_message || stripHtml(comment.message) || "";
    const isLong = rawText.length > MESSAGE_TRUNCATE;
    const displayText = isLong && !expanded ? `${rawText.slice(0, MESSAGE_TRUNCATE).trimEnd()}…` : rawText;

    const avatarColor = getAuthorColor(comment.author);
    const initials = comment.author.slice(0, 2).toUpperCase();

    return (
        <div className="flex gap-2.5">
            {/* Avatar */}
            <div
                className={`${nested ? "size-6 text-[9px]" : "size-7 text-[10px]"} shrink-0 rounded-full ${avatarColor}/80 flex items-center justify-center font-bold text-white mt-0.5 select-none`}
            >
                {initials}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={`font-semibold text-white ${nested ? "text-xs" : "text-sm"}`}>
                        {comment.author}
                    </span>
                    <span className="text-[11px] text-gray-600">{relativeTime(comment.date_added)}</span>
                </div>

                {comment.spoiler && !revealed ? (
                    <div className="mt-1.5">
                        <button
                            onClick={() => setRevealed(true)}
                            className="text-xs px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Reveal Spoiler
                        </button>
                    </div>
                ) : (
                    <div className="mt-1">
                        <p className={`text-gray-400 leading-relaxed whitespace-pre-line ${nested ? "text-xs" : "text-sm"}`}>
                            {displayText}
                        </p>
                        {isLong && (
                            <button
                                onClick={() => setExpanded((v) => !v)}
                                className="mt-0.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                {expanded ? "Show less" : "Show more"}
                            </button>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-3 mt-1.5">
                    {comment.likes > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-600">
                            <Heart className="size-3" />
                            {comment.likes}
                        </span>
                    )}
                    {comment.children.length > 0 && (
                        <button
                            onClick={() => setShowReplies((v) => !v)}
                            className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            {showReplies
                                ? "Hide replies"
                                : `${comment.children.length} ${comment.children.length === 1 ? "reply" : "replies"}`}
                        </button>
                    )}
                </div>

                {comment.children.length > 0 && showReplies && (
                    <div className="mt-2.5 pl-3 border-l border-white/8 space-y-3">
                        {comment.children.map((child) => (
                            <CommentCard key={child.id} comment={child} nested />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

interface MdlThreadsProps {
    initialComments: MdlComment[];
    total: number;
    hasMore: boolean;
    mdlId: string;
}

export function MdlThreads({ initialComments, total, hasMore: initialHasMore, mdlId }: MdlThreadsProps) {
    const [allComments, setAllComments] = useState(initialComments);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const tree = buildTree(allComments);

    async function handleLoadMore() {
        setLoading(true);
        try {
            const next = await loadMoreComments(mdlId, page + 1);
            if (next.comments.length > 0) {
                setAllComments((prev) => [...prev, ...next.comments]);
                setPage((p) => p + 1);
            }
            setHasMore(next.hasMore);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Comments</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-sky-500/15 text-sky-400 border-sky-500/20">
                        via MDL
                    </span>
                    <span className="text-[11px] text-gray-600">{total.toLocaleString()}</span>
                </div>
                <MessageSquare className="size-4 text-gray-700" />
            </div>

            <div className="flex flex-col gap-2">
                {tree.map((comment) => (
                    <div
                        key={comment.id}
                        className="rounded-xl border border-white/5 bg-white/3 p-3.5 hover:bg-white/[0.04] transition-colors"
                    >
                        <CommentCard comment={comment} />
                    </div>
                ))}
            </div>

            {hasMore && (
                <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-gray-300 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <RefreshCw className="size-4 animate-spin" /> Loading…
                        </>
                    ) : (
                        <>
                            Load more <ChevronDown className="size-4" />
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
