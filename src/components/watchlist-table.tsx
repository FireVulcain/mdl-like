"use client";

import { useState, useMemo, useRef, useOptimistic, useTransition, memo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProgress, updateUserMedia } from "@/actions/media";
import { backfillBackdrops, refreshAllBackdrops, backfillAiringStatus, refreshMediaData } from "@/actions/backfill";
import { importMDLNotes } from "@/actions/mdl-import";
import {
    Plus,
    Minus,
    Pencil,
    ChevronDown,
    Eye,
    CheckCircle,
    Clock,
    XCircle,
    RefreshCw,
    X,
    Search,
    BookOpen,
    ImageOff,
    MoreHorizontal,
    Star,
    Layers,
    SlidersHorizontal,
    ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ConfirmAction = "mdl-import" | "backfill" | null;

type NextEpisodeData = {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
    seasonEpisodeCount?: number;
};

type WatchlistItem = {
    id: string;
    source: string;
    externalId: string;
    title: string | null;
    poster: string | null;
    backdrop: string | null;
    year: number | null;
    originCountry: string | null;
    status: string;
    progress: number;
    totalEp: number | null;
    score: number | null;
    mdlRating: number | null;
    notes: string | null;
    season: number;
    mediaType: string;
    genres: string | null;
    airingStatus: string | null;
    nextEpisode?: NextEpisodeData | null;
    seasonAirDate?: string | null;
    mdlSlug?: string | null;
};

interface WatchlistTableProps {
    items: WatchlistItem[];
}

type OptimisticUpdate = {
    id: string;
    progress?: number;
    status?: string;
    score?: number | null;
    notes?: string | null;
};

import { EditMediaDialog } from "./edit-media-dialog";
import { NextEpisodeIndicator } from "./next-episode-indicator";

const statusConfig = {
    Watching: {
        icon: Eye,
        color: "text-blue-400",
        bg: "bg-blue-500/15",
        border: "border-blue-500/30",
        glow: "shadow-blue-500/20",
    },
    Completed: {
        icon: CheckCircle,
        color: "text-emerald-400",
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
        glow: "shadow-emerald-500/20",
    },
    "Plan to Watch": {
        icon: Clock,
        color: "text-slate-400",
        bg: "bg-slate-500/15",
        border: "border-slate-500/30",
        glow: "shadow-slate-500/20",
    },
    Dropped: {
        icon: XCircle,
        color: "text-rose-400",
        bg: "bg-rose-500/15",
        border: "border-rose-500/30",
        glow: "shadow-rose-500/20",
    },
};

export function WatchlistTable({ items }: WatchlistTableProps) {
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [filterCountries, setFilterCountries] = useState<string[]>([]);
    const [filterGenres, setFilterGenres] = useState<string[]>([]);
    const [filterYear, setFilterYear] = useState<string>("All");
    const [search, setSearch] = useState("");
    const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<string>("default");
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [isImportingMDL, setIsImportingMDL] = useState(false);
    const [isBackfillingAiring, setIsBackfillingAiring] = useState(false);
    const [isRefreshingMedia, setIsRefreshingMedia] = useState(false);
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showCountryFilter, setShowCountryFilter] = useState(false);
    const [showGenreFilter, setShowGenreFilter] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

    // Infinite scroll
    const [displayCount, setDisplayCount] = useState(10);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        if (node) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount((prev) => prev + 10);
                    }
                },
                { threshold: 0.1 },
            );
            observerRef.current.observe(node);
        }
    }, []);

    // Optimistic updates
    const [optimisticItems, setOptimisticItems] = useOptimistic(items, (state, update: OptimisticUpdate) => {
        return state.map((item) => (item.id === update.id ? { ...item, ...update } : item));
    });
    const [, startTransition] = useTransition();

    const toggleGroup = (key: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedGroups(newSet);
    };

    const filteredItems = useMemo(() => {
        const result = optimisticItems.filter((item) => {
            if (filterStatuses.length > 0 && !filterStatuses.includes(item.status)) return false;
            if (filterCountries.length > 0 && (!item.originCountry || !filterCountries.includes(item.originCountry))) return false;
            if (filterGenres.length > 0) {
                if (!item.genres) return false;
                const itemGenres = item.genres.split(",").map((g) => g.trim());
                const hasMatchingGenre = filterGenres.some((fg) => itemGenres.includes(fg));
                if (!hasMatchingGenre) return false;
            }
            if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false;
            if (filterYear !== "All" && item.year) {
                if (filterYear === "2010s" && (item.year < 2010 || item.year >= 2020)) return false;
                if (filterYear === "2000s" && (item.year < 2000 || item.year >= 2010)) return false;
                if (filterYear === "Older" && item.year >= 2000) return false;
                if (!["2010s", "2000s", "Older"].includes(filterYear) && item.year.toString() !== filterYear) return false;
            }
            return true;
        });

        if (sortBy !== "default") {
            result.sort((a, b) => {
                switch (sortBy) {
                    case "rating-high":
                        return (b.score || 0) - (a.score || 0);
                    case "rating-low":
                        return (a.score || 0) - (b.score || 0);
                    case "progress-high":
                        const aPercent = a.totalEp ? (a.progress / a.totalEp) * 100 : 0;
                        const bPercent = b.totalEp ? (b.progress / b.totalEp) * 100 : 0;
                        return bPercent - aPercent;
                    case "progress-low":
                        const aPercent2 = a.totalEp ? (a.progress / a.totalEp) * 100 : 0;
                        const bPercent2 = b.totalEp ? (b.progress / b.totalEp) * 100 : 0;
                        return aPercent2 - bPercent2;
                    case "title-az":
                        return (a.title || "").localeCompare(b.title || "");
                    case "title-za":
                        return (b.title || "").localeCompare(a.title || "");
                    case "year-new":
                        return (b.year || 0) - (a.year || 0);
                    case "year-old":
                        return (a.year || 0) - (b.year || 0);
                    default:
                        return 0;
                }
            });
        }

        return result;
    }, [optimisticItems, filterStatuses, filterCountries, filterGenres, search, filterYear, sortBy]);

    useEffect(() => {
        setDisplayCount(10);
    }, [filterStatuses, filterCountries, filterGenres, search, filterYear, sortBy]);

    const toggleStatus = (status: string) => {
        setFilterStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
    };

    const toggleCountry = (country: string) => {
        setFilterCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
    };

    const toggleGenre = (genre: string) => {
        setFilterGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
    };

    const allStatuses = ["Watching", "Completed", "Plan to Watch", "Dropped"];
    const allCountries = useMemo(() => {
        return Array.from(new Set(items.map((item) => item.originCountry).filter(Boolean))).sort() as string[];
    }, [items]);
    const allGenres = useMemo(() => {
        const genreSet = new Set<string>();
        items.forEach((item) => {
            if (item.genres) {
                item.genres.split(",").forEach((g) => genreSet.add(g.trim()));
            }
        });
        return Array.from(genreSet).sort();
    }, [items]);

    const handleProgress = useCallback(
        async (id: string, newProgress: number, title?: string) => {
            startTransition(() => {
                setOptimisticItems({ id, progress: newProgress });
            });
            try {
                await updateProgress(id, newProgress);
                toast.success(`Episode ${newProgress}`, {
                    description: title || "Progress updated",
                });
            } catch (error) {
                console.error("Failed to update progress:", error);
                toast.error("Failed to update progress");
            }
        },
        [startTransition, setOptimisticItems],
    );

    const handleStatusChange = useCallback(
        async (id: string, newStatus: string, title?: string) => {
            startTransition(() => {
                setOptimisticItems({ id, status: newStatus });
            });
            try {
                await updateUserMedia(id, { status: newStatus });
                toast.success(`Status: ${newStatus}`, {
                    description: title || "Status updated",
                });
            } catch (error) {
                console.error("Failed to update status:", error);
                toast.error("Failed to update status");
            }
        },
        [startTransition, setOptimisticItems],
    );

    const openEdit = useCallback((item: WatchlistItem) => {
        setEditingItem(item);
        setEditOpen(true);
    }, []);

    const handleEditClose = (isOpen: boolean) => {
        setEditOpen(isOpen);
        if (!isOpen) {
            setTimeout(() => setEditingItem(null), 100);
        }
    };

    const handleOptimisticEdit = (id: string, updates: Partial<WatchlistItem>) => {
        startTransition(() => {
            setOptimisticItems({ id, ...updates });
        });
    };

    const handleBackfill = async () => {
        setIsBackfilling(true);
        const toastId = toast.loading("Refreshing backdrops...");
        try {
            await backfillBackdrops("mock-user-1");
            const result = await refreshAllBackdrops("mock-user-1");
            if (result.success) {
                toast.success(`Updated ${result.count} season backdrops`, {
                    id: toastId,
                    description: "Refreshing page...",
                });
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.dismiss(toastId);
            }
        } catch (error) {
            console.error("Backfill failed:", error);
            toast.error("Failed to refresh backdrops", {
                id: toastId,
                description: "Check console for details",
            });
        } finally {
            setIsBackfilling(false);
        }
    };

    const handleMDLImport = async () => {
        setIsImportingMDL(true);
        const toastId = toast.loading("Importing notes from MDL...");
        try {
            const result = await importMDLNotes("mock-user-1");

            if (result.success) {
                toast.success(result.message, {
                    id: toastId,
                    description: `Scraped: ${result.stats?.scraped} | Matched: ${result.stats?.matched} | Updated: ${result.stats?.updated} (${result.duration}s)`,
                });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error("Import failed", {
                    id: toastId,
                    description: result.message,
                });
            }
        } catch (error) {
            console.error("MDL import failed:", error);
            toast.error("Failed to import from MDL", {
                id: toastId,
                description: "Check console for details",
            });
        } finally {
            setIsImportingMDL(false);
        }
    };

    const handleBackfillAiring = async () => {
        setIsBackfillingAiring(true);
        const toastId = toast.loading("Updating airing status...");
        try {
            const result = await backfillAiringStatus("mock-user-1");
            if (result.success) {
                toast.success("Airing status updated", {
                    id: toastId,
                    description: result.message,
                });
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.dismiss(toastId);
            }
        } catch (error) {
            console.error("Airing status backfill failed:", error);
            toast.error("Failed to update airing status", {
                id: toastId,
                description: "Check console for details",
            });
        } finally {
            setIsBackfillingAiring(false);
        }
    };

    const handleRefreshMedia = async () => {
        setIsRefreshingMedia(true);
        const toastId = toast.loading("Refreshing media data from TMDB...");
        try {
            const result = await refreshMediaData("mock-user-1");
            if (result.success) {
                toast.success("Media data refreshed", {
                    id: toastId,
                    description: result.message,
                });
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.dismiss(toastId);
            }
        } catch (error) {
            console.error("Media refresh failed:", error);
            toast.error("Failed to refresh media data", {
                id: toastId,
                description: "Check console for details",
            });
        } finally {
            setIsRefreshingMedia(false);
        }
    };

    const activeFilterCount = filterStatuses.length + filterCountries.length + filterGenres.length + (filterYear !== "All" ? 1 : 0);

    return (
        <div className="watchlist-container relative">
            {/* Ambient background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-rose-500/5 rounded-full blur-3xl" />
            </div>

            {/* Filter Bar */}
            <div className="sticky top-20 z-30 -mx-4 px-4 py-2 filter-row">
                <div className="relative">
                    {/* Glass background */}
                    <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-xl rounded-xl border border-white/5" />

                    <div className="relative flex flex-wrap items-center gap-2 p-2.5">
                        {/* Search */}
                        <div className="flex-1 min-w-64 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Search your collection..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full h-9 pl-9 pr-4 bg-white/5 border-0 rounded-lg text-sm text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:bg-white/8 transition-all"
                            />
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="flex items-center gap-2 filter-dropdown-group">
                            {/* Status Filter */}
                            <div className="relative filter-dropdown">
                                <button
                                    onClick={() => {
                                        setShowStatusFilter(!showStatusFilter);
                                        setShowCountryFilter(false);
                                        setShowGenreFilter(false);
                                    }}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                                        filterStatuses.length > 0
                                            ? "bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30"
                                            : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                    }`}
                                >
                                    <Eye className="h-4 w-4" />
                                    <span className="hidden sm:inline">Status</span>
                                    {filterStatuses.length > 0 && (
                                        <span className="bg-blue-500/30 text-blue-300 text-xs px-1.5 py-0.5 rounded-md">{filterStatuses.length}</span>
                                    )}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showStatusFilter ? "rotate-180" : ""}`} />
                                </button>
                                {showStatusFilter && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowStatusFilter(false)} />
                                        <div className="absolute top-full mt-2 left-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-48 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {allStatuses.map((status) => {
                                                const config = statusConfig[status as keyof typeof statusConfig];
                                                const Icon = config?.icon;
                                                const isSelected = filterStatuses.includes(status);
                                                return (
                                                    <button
                                                        key={status}
                                                        onClick={() => toggleStatus(status)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                                                            isSelected
                                                                ? `${config?.bg} ${config?.color}`
                                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                                        }`}
                                                    >
                                                        {Icon && <Icon className="h-4 w-4" />}
                                                        <span className="flex-1 text-left">{status}</span>
                                                        {isSelected && (
                                                            <div className={`w-1.5 h-1.5 rounded-full ${config?.color.replace("text-", "bg-")}`} />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Country Filter */}
                            <div className="relative filter-dropdown">
                                <button
                                    onClick={() => {
                                        setShowCountryFilter(!showCountryFilter);
                                        setShowStatusFilter(false);
                                        setShowGenreFilter(false);
                                    }}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                                        filterCountries.length > 0
                                            ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30"
                                            : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                    }`}
                                >
                                    <span className="hidden sm:inline">Country</span>
                                    {filterCountries.length > 0 && (
                                        <span className="bg-rose-500/30 text-rose-300 text-xs px-1.5 py-0.5 rounded-md">
                                            {filterCountries.length}
                                        </span>
                                    )}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showCountryFilter ? "rotate-180" : ""}`} />
                                </button>
                                {showCountryFilter && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowCountryFilter(false)} />
                                        <div className="absolute top-full mt-2 left-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-40 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {allCountries.map((country) => {
                                                const isSelected = filterCountries.includes(country);
                                                return (
                                                    <button
                                                        key={country}
                                                        onClick={() => toggleCountry(country)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                                                            isSelected
                                                                ? "bg-rose-500/20 text-rose-400"
                                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                                        }`}
                                                    >
                                                        <span className="flex-1 text-left">{country}</span>
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Genre Filter */}
                            <div className="relative filter-dropdown">
                                <button
                                    onClick={() => {
                                        setShowGenreFilter(!showGenreFilter);
                                        setShowStatusFilter(false);
                                        setShowCountryFilter(false);
                                    }}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                                        filterGenres.length > 0
                                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                            : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                    }`}
                                >
                                    <span className="hidden sm:inline">Genre</span>
                                    {filterGenres.length > 0 && (
                                        <span className="bg-emerald-500/30 text-emerald-300 text-xs px-1.5 py-0.5 rounded-md">
                                            {filterGenres.length}
                                        </span>
                                    )}
                                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showGenreFilter ? "rotate-180" : ""}`} />
                                </button>
                                {showGenreFilter && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowGenreFilter(false)} />
                                        <div className="absolute top-full mt-2 left-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-40 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                            {allGenres.map((genre) => {
                                                const isSelected = filterGenres.includes(genre);
                                                return (
                                                    <button
                                                        key={genre}
                                                        onClick={() => toggleGenre(genre)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                                                            isSelected
                                                                ? "bg-emerald-500/20 text-emerald-400"
                                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                                        }`}
                                                    >
                                                        <span className="flex-1 text-left">{genre}</span>
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="hidden md:block w-px h-6 bg-white/10" />

                        {/* Sort & Year */}
                        <div className="flex items-center gap-2">
                            <div className="relative select-wrapper">
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="h-9 pl-3 pr-8 rounded-lg bg-white/5 border-0 text-gray-300 text-sm hover:bg-white/8 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-all cursor-pointer appearance-none"
                                >
                                    <option value="default" className="bg-gray-800">
                                        Default
                                    </option>
                                    <option value="rating-high" className="bg-gray-800">
                                        Rating: High
                                    </option>
                                    <option value="rating-low" className="bg-gray-800">
                                        Rating: Low
                                    </option>
                                    <option value="progress-high" className="bg-gray-800">
                                        Progress: High
                                    </option>
                                    <option value="progress-low" className="bg-gray-800">
                                        Progress: Low
                                    </option>
                                    <option value="title-az" className="bg-gray-800">
                                        Title: A-Z
                                    </option>
                                    <option value="title-za" className="bg-gray-800">
                                        Title: Z-A
                                    </option>
                                    <option value="year-new" className="bg-gray-800">
                                        Year: Newest
                                    </option>
                                    <option value="year-old" className="bg-gray-800">
                                        Year: Oldest
                                    </option>
                                </select>
                                <SlidersHorizontal className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            </div>

                            <div className="relative select-wrapper">
                                <select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(e.target.value)}
                                    className="h-9 pl-3 pr-8 rounded-lg bg-white/5 border-0 text-gray-300 text-sm hover:bg-white/8 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition-all cursor-pointer appearance-none"
                                >
                                    <option value="All" className="bg-gray-800">
                                        All Years
                                    </option>
                                    {Array.from({ length: new Date().getFullYear() - 2020 + 1 }, (_, i) => new Date().getFullYear() - i).map(
                                        (year) => (
                                            <option key={year} value={year} className="bg-gray-800">
                                                {year}
                                            </option>
                                        ),
                                    )}
                                    <option value="2010s" className="bg-gray-800">
                                        2010-2019
                                    </option>
                                    <option value="2000s" className="bg-gray-800">
                                        2000-2009
                                    </option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
                            </div>
                        </div>

                        {/* Actions Menu */}
                        <div className="relative filter-dropdown">
                            <button
                                onClick={() => setShowActionsMenu(!showActionsMenu)}
                                className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/8 hover:text-white transition-all cursor-pointer"
                            >
                                <MoreHorizontal className="h-5 w-5" />
                            </button>
                            {showActionsMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowActionsMenu(false)} />
                                    <div className="absolute top-full mt-2 right-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-52 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <button
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                setConfirmAction("mdl-import");
                                            }}
                                            disabled={isImportingMDL}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <BookOpen className={`h-4 w-4 ${isImportingMDL ? "animate-pulse" : ""}`} />
                                            {isImportingMDL ? "Importing..." : "Import MDL Notes"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                setConfirmAction("backfill");
                                            }}
                                            disabled={isBackfilling}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} />
                                            {isBackfilling ? "Processing..." : "Refresh Backdrops"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                handleBackfillAiring();
                                            }}
                                            disabled={isBackfillingAiring}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isBackfillingAiring ? "animate-spin" : ""}`} />
                                            {isBackfillingAiring ? "Processing..." : "Update Airing Status"}
                                        </button>
                                        <div className="my-1 border-t border-white/5" />
                                        <button
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                handleRefreshMedia();
                                            }}
                                            disabled={isRefreshingMedia}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isRefreshingMedia ? "animate-spin" : ""}`} />
                                            {isRefreshingMedia ? "Refreshing..." : "Refresh TMDB Data"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1 active-filters animate-in fade-in slide-in-from-top-1 duration-300">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filters:</span>
                    {filterStatuses.map((status) => {
                        const config = statusConfig[status as keyof typeof statusConfig];
                        return (
                            <button
                                key={status}
                                onClick={() => toggleStatus(status)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${config?.bg} ${config?.color} hover:opacity-80 transition-all cursor-pointer group`}
                            >
                                {status}
                                <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                            </button>
                        );
                    })}
                    {filterCountries.map((country) => (
                        <button
                            key={country}
                            onClick={() => toggleCountry(country)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-rose-500/15 text-rose-400 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            {country}
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    ))}
                    {filterGenres.map((genre) => (
                        <button
                            key={genre}
                            onClick={() => toggleGenre(genre)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            {genre}
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    ))}
                    {filterYear !== "All" && (
                        <button
                            onClick={() => setFilterYear("All")}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/10 text-gray-300 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            {filterYear}
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setFilterStatuses([]);
                            setFilterCountries([]);
                            setFilterGenres([]);
                            setFilterYear("All");
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Items Grid */}
            <div className="mt-4 space-y-1.5 items-list">
                {(() => {
                    const showsWithWatchingSeason = new Set<string>();
                    filteredItems.forEach((item) => {
                        if (item.status === "Watching") {
                            showsWithWatchingSeason.add(`${item.source}-${item.externalId}`);
                        }
                    });

                    const groupedItems: { [key: string]: WatchlistItem[] } = {};
                    const groupOrder: string[] = [];

                    filteredItems.forEach((item) => {
                        const baseKey = `${item.source}-${item.externalId}`;
                        const hasWatching = showsWithWatchingSeason.has(baseKey);

                        let key: string;
                        if (hasWatching) {
                            if (item.status === "Completed") {
                                key = `${baseKey}-completed`;
                            } else {
                                key = `${baseKey}-${item.season}`;
                            }
                        } else {
                            key = baseKey;
                        }

                        if (!groupedItems[key]) {
                            groupedItems[key] = [];
                            groupOrder.push(key);
                        }
                        groupedItems[key].push(item);
                    });

                    const resultNodes: React.ReactNode[] = [];
                    let displayedCount = 0;

                    for (const groupKey of groupOrder) {
                        if (displayedCount >= displayCount) break;

                        const group = groupedItems[groupKey].toSorted((a, b) => a.season - b.season);
                        const first = group[0];
                        const isMultiSeason = group.length > 1;
                        const isExpanded = expandedGroups.has(groupKey);

                        const animationDelay = `${(displayedCount % 10) * 40}ms`;

                        if (isMultiSeason) {
                            resultNodes.push(
                                <div
                                    key={`group-${groupKey}`}
                                    className="group parent-card animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards"
                                    style={{ animationDelay }}
                                >
                                    <div
                                        className="relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        {/* Background Image */}
                                        <div className="absolute inset-0">
                                            {first.backdrop || first.poster ? (
                                                <Image
                                                    src={first.backdrop || first.poster!}
                                                    alt=""
                                                    fill
                                                    sizes="100vw"
                                                    className="object-cover"
                                                    {...(displayedCount === 0 ? { priority: true } : { loading: "lazy" as const })}
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-linear-to-br from-gray-800 to-gray-900" />
                                            )}
                                            <div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/90 to-gray-900/60" />
                                        </div>

                                        <div className="relative flex items-center gap-4 p-4 parent-card-inner">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-semibold text-white tracking-tight line-clamp-1">{first.title}</h3>
                                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-400">
                                                    <span className="flex items-center gap-1.5">
                                                        <Layers className="h-4 w-4" />
                                                        {group.length} seasons
                                                    </span>
                                                    <span>{first.originCountry}</span>
                                                </div>
                                            </div>

                                            <ChevronDown
                                                className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                                            />
                                        </div>
                                    </div>

                                    {/* Expanded Seasons */}
                                    {isExpanded && (
                                        <div className="mt-1.5 ml-3 space-y-1.5">
                                            {group.map((item, index) => (
                                                <div
                                                    key={item.id}
                                                    className="animate-slide-down-row opacity-0"
                                                    style={{ animationDelay: `${index * 60}ms` }}
                                                >
                                                    <ItemCard
                                                        item={item}
                                                        handleProgress={handleProgress}
                                                        handleStatusChange={handleStatusChange}
                                                        openEdit={openEdit}
                                                        isChild={true}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>,
                            );
                            displayedCount++;
                        } else {
                            resultNodes.push(
                                <div
                                    key={first.id}
                                    className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards"
                                    style={{ animationDelay }}
                                >
                                    <ItemCard
                                        item={first}
                                        handleProgress={handleProgress}
                                        handleStatusChange={handleStatusChange}
                                        openEdit={openEdit}
                                    />
                                </div>,
                            );
                            displayedCount++;
                        }
                    }

                    return resultNodes;
                })()}

                {filteredItems.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                            <Search className="h-8 w-8 text-gray-600" />
                        </div>
                        <p className="text-lg font-medium text-gray-400">No items found</p>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
                    </div>
                )}

                {filteredItems.length > 0 && <div ref={loadMoreRef} className="h-10" />}
            </div>

            {editingItem && (
                <EditMediaDialog
                    key={editingItem.id}
                    item={editingItem}
                    open={editOpen}
                    onOpenChange={handleEditClose}
                    onOptimisticUpdate={handleOptimisticEdit}
                />
            )}

            <ConfirmDialog
                open={confirmAction === "mdl-import"}
                onOpenChange={(open) => !open && setConfirmAction(null)}
                title="Import MDL Notes"
                description="This will import notes from your MyDramaList account. Continue?"
                confirmLabel="Import"
                onConfirm={handleMDLImport}
            />

            <ConfirmDialog
                open={confirmAction === "backfill"}
                onOpenChange={(open) => !open && setConfirmAction(null)}
                title="Refresh Backdrops"
                description="This will refresh backdrops for all multi-season shows, assigning different images per season. Continue?"
                confirmLabel="Refresh"
                onConfirm={handleBackfill}
            />
        </div>
    );
}

const ItemCard = memo(function ItemCard({
    item,
    handleProgress,
    handleStatusChange,
    openEdit,
    isChild = false,
}: {
    item: WatchlistItem;
    handleProgress: (id: string, progress: number, title?: string) => void;
    handleStatusChange: (id: string, newStatus: string, title?: string) => void;
    openEdit: (item: WatchlistItem) => void;
    isChild?: boolean;
}) {
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const desktopButtonRef = useRef<HTMLButtonElement>(null);
    const mobileButtonRef = useRef<HTMLButtonElement>(null);
    const statusInfo = statusConfig[item.status as keyof typeof statusConfig] || statusConfig["Plan to Watch"];
    const StatusIcon = statusInfo.icon;
    const progressPercent = item.totalEp ? (item.progress / item.totalEp) * 100 : 0;
    const allStatuses = ["Watching", "Completed", "Plan to Watch", "Dropped"];

    const handleDropdownToggle = (e: React.MouseEvent, isMobile: boolean = false) => {
        e.stopPropagation();
        if (!showStatusDropdown) {
            const buttonEl = isMobile ? mobileButtonRef.current : desktopButtonRef.current;
            if (buttonEl) {
                const rect = buttonEl.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 8,
                    left: isMobile ? Math.max(16, rect.left) : rect.right - 180,
                });
            }
        }
        setShowStatusDropdown(!showStatusDropdown);
    };

    return (
        <div
            className={`item-card group relative overflow-hidden rounded-2xl transition-all duration-300 hover:scale-[1.005] ${
                isChild ? "bg-linear-to-r from-blue-500/5 to-transparent border border-blue-500/10" : "bg-white/2"
            }`}
        >
            {/* Backdrop with gradient overlay */}
            <div className="absolute inset-0 -z-10">
                {(item.backdrop || item.poster) && !isChild ? (
                    <>
                        <Image
                            src={item.backdrop || item.poster!}
                            alt=""
                            fill
                            sizes="100vw"
                            className="object-cover opacity-30 transition-opacity duration-500 group-hover:opacity-40"
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/95 to-gray-900/80" />
                    </>
                ) : null}
            </div>

            <div className="relative flex items-center gap-3 p-2 item-card-inner">
                {/* Thumbnail */}
                <Link
                    href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                    className={`card-image relative shrink-0 overflow-hidden rounded-lg transition-all duration-300 group-hover:ring-2 group-hover:ring-blue-500/30 ${
                        isChild ? "h-12 w-20" : "h-14 w-24"
                    } ${
                        item.backdrop || item.poster
                            ? "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer"
                            : "bg-gray-800/50 border border-dashed border-gray-700"
                    }`}
                >
                    {item.backdrop || item.poster ? (
                        <Image
                            src={item.backdrop || item.poster!}
                            alt={item.title || ""}
                            fill
                            sizes="(max-width: 768px) 640px, 320px"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            loading="lazy"
                            onLoad={(e) => {
                                const container = e.currentTarget.parentElement;
                                container?.classList.remove(
                                    "animate-shimmer",
                                    "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                    "bg-size-[200%_100%]",
                                );
                            }}
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                            <ImageOff className="h-5 w-5" />
                        </div>
                    )}
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0 card-info">
                    <div className="card-info-text">
                        <div className="flex items-center gap-2 mb-0.5">
                            <Link
                                href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                                className={`font-semibold text-white hover:text-blue-400 transition-colors line-clamp-1 card-title ${
                                    isChild ? "text-sm" : "text-base"
                                }`}
                            >
                                {item.title}
                            </Link>
                            {item.mediaType === "TV" && item.season > 0 && (
                                <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded">S{item.season}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-sm text-gray-500">
                            <span>{item.originCountry || "Unknown"}</span>
                            <span className="w-1 h-1 rounded-full bg-gray-600" />
                            <span>{item.year || "N/A"}</span>
                            {item.status !== "Completed" && (
                                <NextEpisodeIndicator
                                    nextEpisode={item.nextEpisode}
                                    totalEpisodes={item.totalEp}
                                    status={item.airingStatus}
                                    seasonAirDate={item.seasonAirDate}
                                />
                            )}
                        </div>
                    </div>

                    {/* Mobile Status */}
                    <button
                        ref={mobileButtonRef}
                        onClick={(e) => handleDropdownToggle(e, true)}
                        className={`mobile-status-btn items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusInfo.bg} ${statusInfo.border} border hover:opacity-80 transition-opacity cursor-pointer shrink-0`}
                    >
                        <StatusIcon className={`h-3.5 w-3.5 ${statusInfo.color}`} />
                        <span className={`text-xs font-medium ${statusInfo.color}`}>{item.status}</span>
                    </button>
                </div>

                {/* MDL Link - Desktop, KR/CN only */}
                {(item.originCountry === "KR" || item.originCountry === "CN" || item.originCountry === "JP") && (
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(
                                            item.mdlSlug
                                                ? `https://mydramalist.com/${item.mdlSlug}`
                                                : `https://mydramalist.com/search?q=${encodeURIComponent(item.title || "")}`,
                                            "_blank",
                                            "noopener,noreferrer",
                                        );
                                    }}
                                    className="desktop-status-btn card-status cursor-pointer h-8 w-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all shrink-0"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">{item.mdlSlug ? "View on MyDramaList" : "Search on MyDramaList"}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Status Badge - Desktop */}
                <button
                    ref={desktopButtonRef}
                    onClick={(e) => handleDropdownToggle(e, false)}
                    className={`desktop-status-btn card-status flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusInfo.bg} ${statusInfo.border} border min-w-28 justify-center hover:opacity-80 transition-all cursor-pointer`}
                >
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className={`text-sm font-medium ${statusInfo.color}`}>{item.status}</span>
                </button>

                {showStatusDropdown &&
                    typeof window !== "undefined" &&
                    createPortal(
                        <>
                            <div className="fixed inset-0 z-9998" onClick={() => setShowStatusDropdown(false)} />
                            <div
                                className="fixed z-9999 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-44 animate-in fade-in zoom-in-95 duration-200"
                                style={{
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                }}
                            >
                                {allStatuses.map((status) => {
                                    const config = statusConfig[status as keyof typeof statusConfig];
                                    const Icon = config?.icon;
                                    const isSelected = item.status === status;
                                    return (
                                        <button
                                            key={status}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusChange(item.id, status, item.title || undefined);
                                                setShowStatusDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                                                isSelected ? `${config?.bg} ${config?.color}` : "text-gray-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            <span className="flex-1 text-left">{status}</span>
                                            {isSelected && <div className={`w-1.5 h-1.5 rounded-full ${config?.color.replace("text-", "bg-")}`} />}
                                        </button>
                                    );
                                })}
                            </div>
                        </>,
                        document.body,
                    )}

                {/* Progress */}
                <div className="card-progress w-32 space-y-2">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleProgress(item.id, Math.max(0, item.progress - 1), item.title || undefined);
                            }}
                            className="progress-btn cursor-pointer h-7 w-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        >
                            <Minus className="h-3.5 w-3.5" />
                        </button>
                        <div className="flex-1 text-center text-sm">
                            <span className="font-semibold text-white tabular-nums">{item.progress}</span>
                            <span className="text-gray-600 mx-0.5">/</span>
                            <span className="text-gray-500 tabular-nums">{item.totalEp || "?"}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleProgress(item.id, item.progress + 1, item.title || undefined);
                            }}
                            className="progress-btn cursor-pointer h-7 w-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="relative h-1 bg-white/5 rounded-full overflow-hidden progress-bar">
                        <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                                item.status === "Completed"
                                    ? "bg-linear-to-r from-emerald-500 to-emerald-400"
                                    : item.status === "Plan to Watch"
                                      ? "bg-linear-to-r from-slate-500 to-slate-400"
                                      : item.status === "Dropped"
                                        ? "bg-linear-to-r from-rose-500 to-rose-400"
                                        : "bg-linear-to-r from-blue-500 to-blue-400"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Rating */}
                <div className="card-rating flex flex-col items-center gap-0 w-16">
                    {item.score ? (
                        <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                            <span className="text-white font-semibold text-sm tabular-nums">{item.score.toFixed(1)}</span>
                        </div>
                    ) : (
                        <span className="text-gray-600 text-xs">--</span>
                    )}
                    {item.mdlRating ? (
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">MDL</span>
                            <span className="text-blue-400 text-xs tabular-nums">{item.mdlRating.toFixed(1)}</span>
                        </div>
                    ) : null}
                </div>

                {/* Edit */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                    }}
                    className="cursor-pointer card-edit-btn h-8 w-8 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
});
