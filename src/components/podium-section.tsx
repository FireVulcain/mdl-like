"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Trophy, Pencil, X, Crown, ChevronDown, Search } from "lucide-react";
import { saveAllPodiums, type PodiumCategory, type PodiumEntry, type PodiumDraft } from "@/actions/podium";

// ─── Types ────────────────────────────────────────────────────────────────────

type WatchlistPick = {
    externalId: string;
    source: string;
    mediaType: string;
    title: string | null;
    poster: string | null;
    year: number | null;
    originCountry: string | null;
    score: number | null;
    status: string;
};

type PodiumData = Record<PodiumCategory, PodiumEntry[]>;
type DraftData = Record<PodiumCategory, [PodiumDraft, PodiumDraft, PodiumDraft]>;

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { key: PodiumCategory; label: string }[] = [
    { key: "general", label: "Overall" },
    { key: "kdrama", label: "K-Drama" },
    { key: "cdrama", label: "C-Drama" },
];

const RANK_CONFIG = {
    1: {
        barHeight: 96,
        posterClass: "w-24 h-36",
        gradient: "from-amber-500/50 to-amber-700/30",
        border: "border-amber-400/50",
        glow: "shadow-[0_0_30px_rgba(251,191,36,0.25)]",
        ring: "ring-amber-400/60",
        textColor: "text-amber-300",
        label: "1st",
    },
    2: {
        barHeight: 64,
        posterClass: "w-20 h-28",
        gradient: "from-slate-300/40 to-slate-500/20",
        border: "border-slate-300/40",
        glow: "shadow-[0_0_20px_rgba(203,213,225,0.15)]",
        ring: "ring-slate-300/50",
        textColor: "text-slate-300",
        label: "2nd",
    },
    3: {
        barHeight: 48,
        posterClass: "w-20 h-28",
        gradient: "from-orange-700/40 to-orange-900/20",
        border: "border-orange-600/40",
        glow: "shadow-[0_0_20px_rgba(194,65,12,0.2)]",
        ring: "ring-orange-600/50",
        textColor: "text-orange-400",
        label: "3rd",
    },
} as const;

// Display order: 2nd left, 1st center, 3rd right
const DISPLAY_ORDER = [2, 1, 3] as const;

const CDRAMA_COUNTRIES = ["CN", "TW", "HK", "MO"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COMPLETED_STATUSES = ["Completed"];

function dedupeByExternalId(items: WatchlistPick[]): WatchlistPick[] {
    const best = new Map<string, WatchlistPick>();
    for (const item of items) {
        const existing = best.get(item.externalId);
        if (!existing || (item.score ?? -1) > (existing.score ?? -1)) {
            best.set(item.externalId, item);
        }
    }
    return Array.from(best.values());
}

function getWatchlistForCategory(items: WatchlistPick[], category: PodiumCategory): WatchlistPick[] {
    const completed = items.filter((i) => COMPLETED_STATUSES.includes(i.status));
    const deduped = dedupeByExternalId(completed);
    if (category === "kdrama") return deduped.filter((i) => i.originCountry === "KR");
    if (category === "cdrama") return deduped.filter((i) => CDRAMA_COUNTRIES.includes(i.originCountry ?? ""));
    return deduped;
}

function draftFromEntry(entry: PodiumEntry | undefined): PodiumDraft {
    if (!entry) return null;
    return {
        externalId: entry.externalId,
        source: entry.source,
        mediaType: entry.mediaType,
        title: entry.title,
        poster: entry.poster,
        year: entry.year,
    };
}

function draftFromPick(pick: WatchlistPick): PodiumDraft {
    return {
        externalId: pick.externalId,
        source: pick.source,
        mediaType: pick.mediaType,
        title: pick.title ?? "Untitled",
        poster: pick.poster,
        year: pick.year,
    };
}

// ─── MediaPicker ──────────────────────────────────────────────────────────────

function MediaPicker({
    value,
    onChange,
    options,
    placeholder,
    disabledIds,
}: {
    value: PodiumDraft;
    onChange: (pick: WatchlistPick | null) => void;
    options: WatchlistPick[];
    placeholder: string;
    disabledIds: Set<string>;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function onDown(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [open]);

    const selectedFull = value
        ? options.find((o) => o.externalId === value.externalId && o.source === value.source) ?? null
        : null;

    const filtered = options
        .filter((i) => (i.title ?? "").toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
        .slice(0, 30);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all text-left"
            >
                {value ? (
                    <>
                        {value.poster ? (
                            <div className="relative h-9 w-6 shrink-0 rounded overflow-hidden">
                                <Image unoptimized src={value.poster} alt="" fill className="object-cover" sizes="24px" />
                            </div>
                        ) : (
                            <div className="h-9 w-6 shrink-0 rounded bg-white/10" />
                        )}
                        <span className="flex-1 text-sm text-white truncate">{value.title}</span>
                        {selectedFull?.score != null && selectedFull.score > 0 && (
                            <span className="shrink-0 text-xs font-semibold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-md">
                                {selectedFull.score}/10
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onChange(null); }}
                            className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </>
                ) : (
                    <>
                        <span className="flex-1 text-sm text-gray-500">{placeholder}</span>
                        <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    </>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full mt-1 left-0 right-0 rounded-xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden"
                    >
                        <div className="p-2 border-b border-white/8">
                            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/5">
                                <Search className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-52">
                            {filtered.length === 0 && (
                                <p className="text-center text-xs text-gray-500 py-4">No results</p>
                            )}
                            {filtered.map((item) => {
                                const key = `${item.source}-${item.externalId}`;
                                const disabled = disabledIds.has(key) && value?.externalId !== item.externalId;
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => { onChange(item); setOpen(false); setSearch(""); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-white/6 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left"
                                    >
                                        {item.poster ? (
                                            <div className="relative h-9 w-6 shrink-0 rounded overflow-hidden">
                                                <Image unoptimized src={item.poster} alt="" fill className="object-cover" sizes="24px" />
                                            </div>
                                        ) : (
                                            <div className="h-9 w-6 shrink-0 rounded bg-white/10" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{item.title ?? "Untitled"}</p>
                                            {item.year && <p className="text-xs text-gray-500">{item.year}</p>}
                                        </div>
                                        {item.score != null && item.score > 0 && (
                                            <span className="shrink-0 text-xs font-semibold text-amber-400">
                                                {item.score}/10
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── PodiumDisplay ────────────────────────────────────────────────────────────

function PodiumBar({ rank, entry, animDelay }: { rank: 1 | 2 | 3; entry: PodiumEntry; animDelay: number }) {
    const cfg = RANK_CONFIG[rank];
    const mediaHref = `/media/${entry.source.toLowerCase()}-${entry.externalId}`;
    const isFirst = rank === 1;

    return (
        <div className="flex flex-col items-center">
            {/* Poster card */}
            <motion.div
                initial={{ opacity: 0, y: -16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: animDelay + 0.22, duration: 0.45, ease: "easeOut" }}
                className="relative group"
            >
                {isFirst && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.7 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: animDelay + 0.45, type: "spring", stiffness: 260, damping: 18 }}
                        className="absolute -top-6 left-1/2 -translate-x-1/2"
                    >
                        <Crown className="h-5 w-5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                    </motion.div>
                )}
                <Link href={mediaHref} className="block">
                    <div
                        className={`relative ${cfg.posterClass} rounded-xl overflow-hidden ring-2 ${cfg.ring} ${cfg.glow} transition-transform duration-200 group-hover:scale-105`}
                    >
                        {entry.poster ? (
                            <Image
                                unoptimized
                                src={entry.poster}
                                alt={entry.title}
                                fill
                                className="object-cover"
                                sizes="96px"
                            />
                        ) : (
                            <div className="absolute inset-0 bg-white/8 flex items-center justify-center">
                                <span className="text-gray-500 text-xs text-center px-1">{entry.title}</span>
                            </div>
                        )}
                        {/* Shimmer for 1st place */}
                        {isFirst && (
                            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer-sweep_2.5s_ease-in-out_1s_forwards]" />
                        )}
                    </div>
                </Link>
                <p
                    className={`mt-1.5 text-center text-xs font-medium ${cfg.textColor} max-w-24 truncate`}
                    title={entry.title}
                >
                    {entry.title}
                </p>
                {entry.year && <p className="text-center text-[10px] text-gray-600 mt-0.5">{entry.year}</p>}
            </motion.div>

            {/* Platform bar */}
            <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                    delay: animDelay,
                    type: "spring",
                    stiffness: 180,
                    damping: 22,
                }}
                style={{ height: cfg.barHeight, transformOrigin: "bottom" }}
                className={`mt-2 w-full rounded-t-xl bg-linear-to-t ${cfg.gradient} border border-b-0 ${cfg.border} flex flex-col items-center justify-end pb-2.5 relative overflow-hidden`}
            >
                {/* Inner glow line at top */}
                <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
                <span className={`text-sm font-bold ${cfg.textColor}`}>{cfg.label}</span>
            </motion.div>
        </div>
    );
}

function PodiumDisplay({ entries }: { entries: PodiumEntry[] }) {
    const byRank = Object.fromEntries(entries.map((e) => [e.rank, e])) as Record<number, PodiumEntry>;

    return (
        <div className="flex items-end justify-center gap-3 pt-10 pb-0">
            {DISPLAY_ORDER.map((rank) => {
                const entry = byRank[rank];
                if (!entry) return null;
                const delayMap = { 1: 0.18, 2: 0.09, 3: 0 };
                return (
                    <div key={rank} className={`flex-1 max-w-[${rank === 1 ? "120px" : "96px"}]`}>
                        <PodiumBar rank={rank as 1 | 2 | 3} entry={entry} animDelay={delayMap[rank as 1 | 2 | 3]} />
                    </div>
                );
            })}
        </div>
    );
}

// ─── PodiumEditor ─────────────────────────────────────────────────────────────

function PodiumEditor({
    profileUserId,
    initialDrafts,
    watchlist,
    onClose,
}: {
    profileUserId: string;
    initialDrafts: DraftData;
    watchlist: WatchlistPick[];
    onClose: () => void;
}) {
    const [drafts, setDrafts] = useState<DraftData>(initialDrafts);
    const [activeTab, setActiveTab] = useState<PodiumCategory>("general");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    function setSlot(cat: PodiumCategory, idx: 0 | 1 | 2, pick: WatchlistPick | null) {
        setDrafts((prev) => {
            const next = { ...prev, [cat]: [...prev[cat]] as [PodiumDraft, PodiumDraft, PodiumDraft] };
            next[cat][idx] = pick ? draftFromPick(pick) : null;
            return next;
        });
    }

    function handleSave() {
        setError(null);
        startTransition(async () => {
            try {
                await saveAllPodiums(profileUserId, drafts);
                onClose();
            } catch {
                setError("Failed to save. Please try again.");
            }
        });
    }

    const catOptions = getWatchlistForCategory(watchlist, activeTab);
    const slots = drafts[activeTab];
    const usedIds = new Set(
        slots.filter(Boolean).map((d) => `${d!.source}-${d!.externalId}`)
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl bg-white/4 border border-white/10 p-5 space-y-4"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Edit your Top 3 Podium</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Category tabs */}
            <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8 w-fit">
                {CATEGORIES.map(({ key, label }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            activeTab === key ? "text-white" : "text-gray-400 hover:text-gray-200"
                        }`}
                    >
                        {activeTab === key && (
                            <motion.div
                                layoutId="editor-tab-bg"
                                className="absolute inset-0 rounded-lg bg-white/12"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        <span className="relative">{label}</span>
                    </button>
                ))}
            </div>

            {/* Rank slots */}
            <div className="space-y-2.5">
                {([0, 1, 2] as const).map((idx) => {
                    const rankLabel = RANK_CONFIG[(idx + 1) as 1 | 2 | 3].label;
                    const cfg = RANK_CONFIG[(idx + 1) as 1 | 2 | 3];
                    return (
                        <div key={idx} className="flex items-center gap-3">
                            <span className={`text-xs font-bold w-8 shrink-0 ${cfg.textColor}`}>{rankLabel}</span>
                            <div className="flex-1">
                                <MediaPicker
                                    value={slots[idx]}
                                    onChange={(pick) => setSlot(activeTab, idx, pick)}
                                    options={catOptions}
                                    placeholder={`Select ${rankLabel} place...`}
                                    disabledIds={usedIds}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {catOptions.length === 0 && (
                <p className="text-xs text-amber-400/80 bg-amber-400/8 border border-amber-400/20 rounded-lg px-3 py-2">
                    No completed {activeTab === "kdrama" ? "Korean" : "Chinese/Taiwanese"} titles in your watchlist yet.
                </p>
            )}

            {error && <p className="text-xs text-rose-400">{error}</p>}

            <div className="flex gap-2 pt-1">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex-1 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                >
                    {isPending ? "Saving..." : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="py-2 px-4 rounded-xl bg-white/6 hover:bg-white/10 text-gray-300 text-sm transition-colors"
                >
                    Cancel
                </button>
            </div>
        </motion.div>
    );
}

// ─── PodiumSection (main export) ──────────────────────────────────────────────

export function PodiumSection({
    podiums,
    isOwner,
    profileUserId,
    watchlist,
}: {
    podiums: PodiumData;
    isOwner: boolean;
    profileUserId: string;
    watchlist: WatchlistPick[];
}) {
    const completedTabs = CATEGORIES.filter(({ key }) => podiums[key].length === 3);
    const [activeTab, setActiveTab] = useState<PodiumCategory>(
        completedTabs[0]?.key ?? "general"
    );
    const [editMode, setEditMode] = useState(false);

    // Build initial draft from current podium data
    const initialDrafts: DraftData = {
        general: [draftFromEntry(podiums.general[0]), draftFromEntry(podiums.general[1]), draftFromEntry(podiums.general[2])],
        kdrama:  [draftFromEntry(podiums.kdrama[0]),  draftFromEntry(podiums.kdrama[1]),  draftFromEntry(podiums.kdrama[2])],
        cdrama:  [draftFromEntry(podiums.cdrama[0]),  draftFromEntry(podiums.cdrama[1]),  draftFromEntry(podiums.cdrama[2])],
    };

    // If not owner and no completed podiums, render nothing
    if (!isOwner && completedTabs.length === 0) return null;

    const tabsToShow = isOwner ? CATEGORIES : completedTabs;

    // Ensure activeTab is valid
    const safeActiveTab: PodiumCategory =
        tabsToShow.some((t) => t.key === activeTab) ? activeTab : tabsToShow[0]?.key ?? "general";

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    <h2 className="text-lg font-semibold text-white">Top 3</h2>
                </div>
                {isOwner && !editMode && (
                    <button
                        onClick={() => setEditMode(true)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/8"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {editMode ? (
                    <PodiumEditor
                        key="editor"
                        profileUserId={profileUserId}
                        initialDrafts={initialDrafts}
                        watchlist={watchlist}
                        onClose={() => setEditMode(false)}
                    />
                ) : completedTabs.length === 0 && isOwner ? (
                    /* Empty state for owner */
                    <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3 py-10 rounded-2xl border border-dashed border-white/10 text-center"
                    >
                        <Trophy className="h-8 w-8 text-gray-600" />
                        <div>
                            <p className="text-sm text-gray-400 font-medium">No podium yet</p>
                            <p className="text-xs text-gray-600 mt-0.5">Showcase your all-time favorites</p>
                        </div>
                        <button
                            onClick={() => setEditMode(true)}
                            className="text-xs px-4 py-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-500 text-white font-medium transition-colors"
                        >
                            Create your podium
                        </button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="display"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-white/3 border border-white/8 overflow-hidden"
                    >
                        {/* Tabs */}
                        {tabsToShow.length > 1 && (
                            <div className="flex gap-1 p-3 pb-0">
                                <div className="flex gap-1 p-1 rounded-xl bg-white/4 border border-white/8">
                                    {tabsToShow.map(({ key, label }) => {
                                        const completed = podiums[key].length === 3;
                                        return (
                                            <button
                                                key={key}
                                                onClick={() => setActiveTab(key)}
                                                disabled={!completed && !isOwner}
                                                className={`relative px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                                    safeActiveTab === key
                                                        ? "text-white"
                                                        : completed || isOwner
                                                        ? "text-gray-400 hover:text-gray-200"
                                                        : "text-gray-600 cursor-not-allowed"
                                                }`}
                                            >
                                                {safeActiveTab === key && (
                                                    <motion.div
                                                        layoutId="podium-tab-bg"
                                                        className="absolute inset-0 rounded-lg bg-white/12"
                                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                                    />
                                                )}
                                                <span className="relative">{label}</span>
                                                {!completed && isOwner && (
                                                    <span className="relative ml-1 text-[9px] text-gray-600">empty</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Podium display */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={safeActiveTab}
                                initial={{ opacity: 0, scale: 0.97 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.97 }}
                                transition={{ duration: 0.22 }}
                                className="px-6 pb-5"
                            >
                                {podiums[safeActiveTab].length === 3 ? (
                                    <PodiumDisplay entries={podiums[safeActiveTab]} />
                                ) : (
                                    <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
                                        Podium incomplete — click Edit to fill it in.
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
