"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ChevronDown, RefreshCw, MessageSquare, Eye } from "lucide-react";
import { MdlComment } from "@/lib/kuryana";
import { loadMoreComments, type ThreadKind } from "@/actions/mdl-threads";
import { mdlUserHref } from "@/lib/mdl-user-link";

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

/**
 * Every reply under a comment, however deep. The old label counted direct
 * children only, so a thread announcing "1 reply" could open onto six.
 */
function countReplies(node: CommentNode): number {
    return node.children.reduce((n, child) => n + 1 + countReplies(child), 0);
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

const AUTHOR_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-pink-500", "bg-teal-500"];

function getAuthorColor(name: string): string {
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return AUTHOR_COLORS[hash % AUTHOR_COLORS.length];
}

function stripHtml(str: string): string {
    return str
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const MESSAGE_TRUNCATE = 280;

function CommentCard({
    comment,
    nested = false,
    collapsed,
    onToggle,
}: {
    comment: CommentNode;
    nested?: boolean;
    collapsed: Set<number>;
    onToggle: (id: number) => void;
}) {
    const [revealed, setRevealed] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const replyCount = countReplies(comment);
    const folded = collapsed.has(comment.id);

    if (comment.deleted) {
        return (
            <div className="flex gap-2.5">
                <div className={`${nested ? "size-6" : "size-7"} shrink-0 rounded-full bg-surface-2`} />
                <p className="text-xs text-fg-faint italic pt-1.5">[Comment removed]</p>
            </div>
        );
    }

    const rawText = comment.raw_message || stripHtml(comment.message) || "";
    const isLong = rawText.length > MESSAGE_TRUNCATE;
    const displayText = isLong && !expanded ? `${rawText.slice(0, MESSAGE_TRUNCATE).trimEnd()}…` : rawText;

    // `author` is MDL's key for the account — a username for some, a bare id for
    // others — and only the key works as a link. The name is what to show.
    const authorName = comment.author_name || comment.author;
    const avatarColor = getAuthorColor(authorName);
    const initials = authorName.slice(0, 2).toUpperCase();
    const listHref = mdlUserHref(comment.author, authorName);

    return (
        <div className="flex gap-2.5">
            {/* Avatar */}
            <Link
                href={listHref}
                title={`See ${authorName}'s list`}
                className={`relative ${nested ? "size-6 text-xs" : "size-7 text-xs"} shrink-0 rounded-full ${!comment.avatar_url ? avatarColor + "/80" : "bg-surface-2"} flex items-center justify-center font-bold text-fg mt-0.5 select-none overflow-hidden hover:ring-2 hover:ring-sky-500/50 transition-all`}
            >
                {comment.avatar_url ? (
                    <Image src={comment.avatar_url} alt={authorName} fill className="object-cover" unoptimized={true} />
                ) : (
                    initials
                )}
            </Link>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <Link
                        href={listHref}
                        className="text-sm font-semibold text-fg hover:text-sky-400 transition-colors"
                    >
                        {authorName}
                    </Link>
                    <span className="text-xs text-fg-dim">{relativeTime(comment.date_added)}</span>
                </div>

                {comment.spoiler && !revealed ? (
                    // A dotted underline rather than a box: it reads as text that
                    // is being withheld, which is what a spoiler gate is, and it
                    // stops the comment list from sprouting a button per entry.
                    <div className="mt-1.5">
                        <button
                            onClick={() => setRevealed(true)}
                            className="cursor-pointer inline-flex items-center gap-1.5 text-sm italic text-fg-dim underline decoration-dotted decoration-gray-600 underline-offset-4 hover:text-fg-soft hover:decoration-gray-400 transition-colors"
                        >
                            <Eye className="size-3.5" />
                            Reveal spoiler
                        </button>
                    </div>
                ) : (
                    <div className="mt-1">
                        <p className="text-sm text-fg-soft leading-relaxed whitespace-pre-line wrap-break-word">{displayText}</p>
                        {isLong && (
                            <button
                                onClick={() => setExpanded((v) => !v)}
                                className="cursor-pointer mt-0.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                            >
                                {expanded ? "Show less" : "Show more"}
                            </button>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-3 mt-1.5">
                    {comment.likes > 0 && (
                        <span className="flex items-center gap-1 text-xs text-fg-dim">
                            <Heart className="size-3" />
                            {comment.likes}
                        </span>
                    )}
                    {replyCount > 0 && (
                        <button
                            onClick={() => onToggle(comment.id)}
                            aria-expanded={!folded}
                            className="cursor-pointer flex items-center gap-1 text-xs text-fg-dim hover:text-fg-soft transition-colors"
                        >
                            {/* The chevron carries the state, so the label can say
                                the same thing open or shut. The button keeps its
                                width and nothing below it shifts on a click. */}
                            <ChevronDown className={`size-3 transition-transform ${folded ? "-rotate-90" : ""}`} />
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                        </button>
                    )}
                </div>

                {comment.children.length > 0 && !folded && (
                    <div className="mt-2.5 flex">
                        {/* The rule down the left of a thread is also the way to
                            shut it — the target a threaded comment list trains
                            people to reach for. It stays a hairline until the
                            pointer is on it, so it costs the page nothing. */}
                        <button
                            onClick={() => onToggle(comment.id)}
                            title="Collapse replies"
                            aria-label="Collapse replies"
                            className="group/rail relative w-3 shrink-0 cursor-pointer"
                        >
                            <span className="absolute inset-y-0 left-0 w-px bg-white/8 transition-colors group-hover/rail:bg-sky-500/60" />
                        </button>
                        <div className="min-w-0 flex-1 space-y-3">
                            {comment.children.map((child) => (
                                <CommentCard key={child.id} comment={child} nested collapsed={collapsed} onToggle={onToggle} />
                            ))}
                        </div>
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
    // Person threads live at a different path but return the same payload, so
    // the same list serves both — only the loader changes.
    kind?: ThreadKind;
}

export function MdlThreads({ initialComments, total, hasMore: initialHasMore, mdlId, kind = "media" }: MdlThreadsProps) {
    const [allComments, setAllComments] = useState(initialComments);
    const [hasMore, setHasMore] = useState(initialHasMore);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    // Which threads are shut. Held here rather than inside each card so one
    // control can fold the whole section, and so a thread the reader shut stays
    // shut when "Load more" re-renders the list around it.
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

    const tree = useMemo(() => buildTree(allComments), [allComments]);

    // Every comment that has anything under it, at any depth — the set
    // "Collapse all" writes, and the set it compares against to know its label.
    const foldableIds = useMemo(() => {
        const ids: number[] = [];
        const walk = (nodes: CommentNode[]) => {
            for (const node of nodes) {
                if (node.children.length > 0) {
                    ids.push(node.id);
                    walk(node.children);
                }
            }
        };
        walk(tree);
        return ids;
    }, [tree]);

    const allFolded = foldableIds.length > 0 && foldableIds.every((id) => collapsed.has(id));

    function toggleFold(id: number) {
        setCollapsed((prev) => {
            const next = new Set(prev);
            if (!next.delete(id)) next.add(id);
            return next;
        });
    }

    async function handleLoadMore() {
        setLoading(true);
        try {
            const next = await loadMoreComments(mdlId, page + 1, kind);
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
                    <h3 className="font-display text-lg font-semibold text-fg">Comments</h3>
                    <span className="text-xs text-fg-dim">{total.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                    {foldableIds.length > 0 && (
                        <button
                            onClick={() => setCollapsed(allFolded ? new Set() : new Set(foldableIds))}
                            className="cursor-pointer text-xs text-fg-dim hover:text-fg-soft transition-colors"
                        >
                            {allFolded ? "Expand all" : "Collapse all"}
                        </button>
                    )}
                    <MessageSquare className="size-4 text-fg-faint" />
                </div>
            </div>

            {/* Same treatment as the reviews and the episode list: a stack of the
                same thing, separated by a rule rather than each drawn as a box. */}
            <div className="flex flex-col divide-y divide-line">
                {tree.map((comment) => (
                    <div key={comment.id} className="py-3.5">
                        <CommentCard comment={comment} collapsed={collapsed} onToggle={toggleFold} />
                    </div>
                ))}
            </div>

            {hasMore && (
                <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="mt-3 flex w-full items-center justify-center gap-1.5 py-2.5 text-sm text-fg-muted hover:text-fg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
