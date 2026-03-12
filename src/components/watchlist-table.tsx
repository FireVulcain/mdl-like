"use client";

import { useState, useMemo, useRef, useOptimistic, useTransition, memo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProgress, updateUserMedia } from "@/actions/media";
import { backfillBackdrops, refreshAllBackdrops, refreshMediaData, refreshWatchlistMdlRatings } from "@/actions/backfill";
import { importWatchlist } from "@/actions/import-watchlist";
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
    ImageOff,
    MoreHorizontal,
    Star,
    Layers,
    SlidersHorizontal,
    ExternalLink,
    Download,
    Upload,
    Tv,
    GalleryVertical,
    GalleryHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "./confirm-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type ConfirmAction = "backfill" | null;

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
    readOnly?: boolean;
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

export function WatchlistTable({ items, readOnly = false }: WatchlistTableProps) {
    const searchParams = useSearchParams();

    // Filter/sort: useState for instant UI updates, URL synced silently via
    // history.replaceState so back/forward navigation restores state without
    // triggering a server round-trip.
    const [filterStatuses, setFilterStatuses] = useState<string[]>(() => searchParams.get("status")?.split(",").filter(Boolean) ?? []);
    const [filterCountries, setFilterCountries] = useState<string[]>(() => searchParams.get("country")?.split(",").filter(Boolean) ?? []);
    const [filterGenres, setFilterGenres] = useState<string[]>(() => searchParams.get("genre")?.split(",").filter(Boolean) ?? []);
    const [filterYear, setFilterYear] = useState<string>(() => searchParams.get("year") ?? "All");
    const [search, setSearch] = useState<string>(() => searchParams.get("q") ?? "");
    const [sortBy, setSortBy] = useState<string>(() => searchParams.get("sort") ?? "default");
    const [filterAiringOnly, setFilterAiringOnly] = useState<boolean>(() => searchParams.get("airing") === "1");
    const [thumbnailStyle, setThumbnailStyle] = useState<"poster" | "backdrop">("poster");
    useEffect(() => {
        const saved = localStorage.getItem("watchlist-thumbnail-style");
        if (saved === "poster" || saved === "backdrop") setThumbnailStyle(saved);
    }, []);

    const syncUrl = useCallback((key: string, value: string | null) => {
        const params = new URLSearchParams(window.location.search);
        if (value === null || value === "") {
            params.delete(key);
        } else {
            params.set(key, value);
        }
        const qs = params.toString();
        window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, []);

    const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [isBackfilling, setIsBackfilling] = useState(false);
    const [isRefreshingMedia, setIsRefreshingMedia] = useState(false);
    const [isRefreshingMdl, setIsRefreshingMdl] = useState(false);
    const [showMdlRefreshModal, setShowMdlRefreshModal] = useState(false);
    const [mdlRefreshStatuses, setMdlRefreshStatuses] = useState<string[]>([]);
    const [showCountryFilter, setShowCountryFilter] = useState(false);
    const [showGenreFilter, setShowGenreFilter] = useState(false);
    const [showSortFilter, setShowSortFilter] = useState(false);
    const [showYearFilter, setShowYearFilter] = useState(false);
    const [showActionsMenu, setShowActionsMenu] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    const [isImportingJSON, setIsImportingJSON] = useState(false);
    const importFileRef = useRef<HTMLInputElement>(null);
    const [statusLabelHidden, setStatusLabelHidden] = useState(false);
    useEffect(() => {
        const check = () => setStatusLabelHidden(window.innerWidth >= 768 && window.innerWidth < 1536);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

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
            if (filterAiringOnly && !item.nextEpisode) return false;
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
                    case "next-episode-asc": {
                        const aDate = a.nextEpisode?.airDate ?? null;
                        const bDate = b.nextEpisode?.airDate ?? null;
                        if (aDate && bDate) return aDate.localeCompare(bDate);
                        if (aDate) return -1;
                        if (bDate) return 1;
                        return 0;
                    }
                    case "next-episode-desc": {
                        const aDate = a.nextEpisode?.airDate ?? null;
                        const bDate = b.nextEpisode?.airDate ?? null;
                        if (aDate && bDate) return bDate.localeCompare(aDate);
                        if (aDate) return 1;
                        if (bDate) return -1;
                        return 0;
                    }
                    default:
                        return 0;
                }
            });
        }

        return result;
    }, [optimisticItems, filterStatuses, filterCountries, filterGenres, search, filterYear, sortBy, filterAiringOnly]);

    useEffect(() => {
        setDisplayCount(10);
    }, [filterStatuses, filterCountries, filterGenres, search, filterYear, sortBy, filterAiringOnly]);

    const toggleStatus = (status: string) => {
        const next = filterStatuses.includes(status) ? [] : [status];
        setFilterStatuses(next);
        syncUrl("status", next[0] ?? null);
    };

    const toggleCountry = (country: string) => {
        const next = filterCountries.includes(country) ? filterCountries.filter((c) => c !== country) : [...filterCountries, country];
        setFilterCountries(next);
        syncUrl("country", next.join(",") || null);
    };

    const toggleGenre = (genre: string) => {
        const next = filterGenres.includes(genre) ? filterGenres.filter((g) => g !== genre) : [...filterGenres, genre];
        setFilterGenres(next);
        syncUrl("genre", next.join(",") || null);
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
            await backfillBackdrops();
            const result = await refreshAllBackdrops();
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

    const handleRefreshMedia = async () => {
        setIsRefreshingMedia(true);
        const toastId = toast.loading("Refreshing media data from TMDB...");
        try {
            const result = await refreshMediaData();
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

    const handleRefreshMdlRatings = async (statuses: string[]) => {
        setIsRefreshingMdl(true);
        setShowMdlRefreshModal(false);
        const label = statuses.length === 0 ? "all media" : statuses.join(", ");
        const toastId = toast.loading(`Refreshing MDL ratings for ${label}...`);
        try {
            const result = await refreshWatchlistMdlRatings(statuses.length ? statuses : undefined);
            if (result.success) {
                toast.success(`MDL ratings refreshed for ${result.count} show${result.count !== 1 ? "s" : ""}`, {
                    id: toastId,
                    description: result.count > 0 ? "Refreshing page..." : "Everything is up to date.",
                });
                if (result.count > 0) setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.dismiss(toastId);
            }
        } catch (error) {
            console.error("MDL refresh failed:", error);
            toast.error("Failed to refresh MDL ratings", {
                id: toastId,
                description: "Check console for details",
            });
        } finally {
            setIsRefreshingMdl(false);
        }
    };

    const activeFilterCount = filterStatuses.length + filterCountries.length + filterGenres.length + (filterYear !== "All" ? 1 : 0) + (filterAiringOnly ? 1 : 0);

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const exportCSV = () => {
        const headers = ["Title", "Type", "Status", "Season", "Progress", "Total Episodes", "Score", "MDL Rating", "Country", "Year", "Genres", "Notes", "Airing Status"];
        const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = filteredItems.map((item) => [
            item.title,
            item.mediaType,
            item.status,
            item.season,
            item.progress,
            item.totalEp ?? "",
            item.score ?? "",
            item.mdlRating ?? "",
            item.originCountry ?? "",
            item.year ?? "",
            item.genres ?? "",
            item.notes ?? "",
            item.airingStatus ?? "",
        ]);
        const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
        downloadFile(csv, "watchlist.csv", "text/csv;charset=utf-8;");
    };

    const exportJSON = () => {
        const data = filteredItems.map((item) => ({
            title: item.title,
            type: item.mediaType,
            status: item.status,
            season: item.season,
            progress: item.progress,
            totalEpisodes: item.totalEp,
            score: item.score,
            mdlRating: item.mdlRating,
            country: item.originCountry,
            year: item.year,
            genres: item.genres,
            notes: item.notes,
            airingStatus: item.airingStatus,
            source: item.source,
            externalId: item.externalId,
        }));
        downloadFile(JSON.stringify(data, null, 2), "watchlist.json", "application/json");
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";

        let parsed: unknown[];
        try {
            const text = await file.text();
            parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array.");
        } catch (err) {
            toast.error("Invalid JSON file", { description: err instanceof Error ? err.message : "Could not parse file." });
            return;
        }

        setIsImportingJSON(true);
        try {
            const result = await importWatchlist(parsed);
            if (result.imported > 0) {
                toast.success(`Imported ${result.imported} item${result.imported !== 1 ? "s" : ""}`, {
                    description: result.skipped > 0 ? `${result.skipped} already existed and were skipped.` : undefined,
                });
            } else {
                toast.info("Nothing new to import", {
                    description: `All ${result.skipped} item${result.skipped !== 1 ? "s" : ""} already exist in your watchlist.`,
                });
            }
            if (result.errors.length > 0) {
                console.warn("Import errors:", result.errors);
            }
        } catch {
            toast.error("Import failed", { description: "An unexpected error occurred." });
        } finally {
            setIsImportingJSON(false);
        }
    };

    return (
        <div className="watchlist-container relative">
            {!readOnly && <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />}
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
                        <div className="w-full md:flex-1 md:min-w-0 relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                            <Input
                                placeholder="Search your collection..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); syncUrl("q", e.target.value || null); }}
                                className="w-full h-9 pl-9 pr-4 bg-white/5 border-0 rounded-lg text-sm text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-blue-500/50 focus-visible:bg-white/8 transition-all"
                            />
                        </div>

                        {/* Filter Dropdowns */}
                        <div className="flex items-center gap-2 filter-dropdown-group w-full md:w-auto overflow-x-auto md:overflow-visible scrollbar-none pb-0.5 md:pb-0">
                            {/* Status Pills */}
                            <TooltipProvider delayDuration={300}>
                            {allStatuses.map((status) => {
                                const config = statusConfig[status as keyof typeof statusConfig];
                                const Icon = config?.icon;
                                const isSelected = filterStatuses.includes(status);
                                const btn = (
                                    <button
                                        onClick={() => toggleStatus(status)}
                                        className={`h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-all cursor-pointer shrink-0 ${
                                            isSelected
                                                ? `${config?.bg} ${config?.color} ring-1 ${config?.border}`
                                                : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                        }`}
                                    >
                                        {Icon && <Icon className="h-4 w-4 shrink-0" />}
                                        <span className="inline md:hidden 2xl:inline">{status}</span>
                                    </button>
                                );
                                return statusLabelHidden ? (
                                    <Tooltip key={status}>
                                        <TooltipTrigger asChild>{btn}</TooltipTrigger>
                                        <TooltipContent side="bottom">{status}</TooltipContent>
                                    </Tooltip>
                                ) : <span key={status}>{btn}</span>;
                            })}
                            </TooltipProvider>

                            {/* Country Filter */}
                            <div className="relative filter-dropdown">
                                <button
                                    onClick={() => {
                                        setShowCountryFilter(!showCountryFilter);

                                        setShowGenreFilter(false);
                                        setShowSortFilter(false);
                                        setShowYearFilter(false);
                                    }}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                                        filterCountries.length > 0
                                            ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/30"
                                            : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                    }`}
                                >
                                    <span className="">Country</span>
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

                                        setShowCountryFilter(false);
                                        setShowSortFilter(false);
                                        setShowYearFilter(false);
                                    }}
                                    className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${
                                        filterGenres.length > 0
                                            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                            : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                                    }`}
                                >
                                    <span className="">Genre</span>
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

                        {/* Airing toggle */}
                        <button
                            onClick={() => { const next = !filterAiringOnly; setFilterAiringOnly(next); syncUrl("airing", next ? "1" : null); }}
                            className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer shrink-0 ${
                                filterAiringOnly
                                    ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30"
                                    : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"
                            }`}
                        >
                            <Tv className="h-4 w-4" />
                            <span className="">Airing</span>
                        </button>

                        {/* Divider */}
                        <div className="w-px h-6 bg-white/10 shrink-0" />

                        {/* Sort */}
                        {(() => {
                            const sortLabels: Record<string, string> = {
                                default: "Sort", "rating-high": "Rating ↓", "rating-low": "Rating ↑",
                                "progress-high": "Progress ↓", "progress-low": "Progress ↑",
                                "title-az": "Title A-Z", "title-za": "Title Z-A",
                                "year-new": "Year ↓", "year-old": "Year ↑",
                                "next-episode-asc": "Next Ep ↑", "next-episode-desc": "Next Ep ↓",
                            };
                            const sortOptions = [
                                { value: "default", label: "Default" },
                                { value: "rating-high", label: "Rating: High" },
                                { value: "rating-low", label: "Rating: Low" },
                                { value: "progress-high", label: "Progress: High" },
                                { value: "progress-low", label: "Progress: Low" },
                                { value: "title-az", label: "Title: A-Z" },
                                { value: "title-za", label: "Title: Z-A" },
                                { value: "year-new", label: "Year: Newest" },
                                { value: "year-old", label: "Year: Oldest" },
                                { value: "next-episode-asc", label: "Next Episode: Soonest" },
                                { value: "next-episode-desc", label: "Next Episode: Latest" },
                            ];
                            const isActive = sortBy !== "default";
                            return (
                                <div className="relative filter-dropdown shrink-0">
                                    <button
                                        onClick={() => { setShowSortFilter(!showSortFilter); setShowYearFilter(false); setShowCountryFilter(false); setShowGenreFilter(false); }}
                                        className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${isActive ? "bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30" : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"}`}
                                    >
                                        <SlidersHorizontal className="h-4 w-4" />
                                        <span>{sortLabels[sortBy] ?? "Sort"}</span>
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSortFilter ? "rotate-180" : ""}`} />
                                    </button>
                                    {showSortFilter && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowSortFilter(false)} />
                                            <div className="absolute top-full mt-2 left-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-48 animate-in fade-in slide-in-from-top-2 duration-200">
                                                {sortOptions.map((opt) => {
                                                    const isSelected = sortBy === opt.value;
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => { setSortBy(opt.value); syncUrl("sort", opt.value === "default" ? null : opt.value); setShowSortFilter(false); }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${isSelected ? "bg-violet-500/20 text-violet-400" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                                        >
                                                            <span className="flex-1 text-left">{opt.label}</span>
                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Year */}
                        {(() => {
                            const yearOptions = [
                                { value: "All", label: "All Years" },
                                ...Array.from({ length: new Date().getFullYear() - 2020 + 1 }, (_, i) => {
                                    const y = new Date().getFullYear() - i;
                                    return { value: String(y), label: String(y) };
                                }),
                                { value: "2010s", label: "2010-2019" },
                                { value: "2000s", label: "2000-2009" },
                            ];
                            const isActive = filterYear !== "All";
                            const label = isActive ? (yearOptions.find(o => o.value === filterYear)?.label ?? filterYear) : "Year";
                            return (
                                <div className="relative filter-dropdown shrink-0">
                                    <button
                                        onClick={() => { setShowYearFilter(!showYearFilter); setShowSortFilter(false); setShowCountryFilter(false); setShowGenreFilter(false); }}
                                        className={`h-9 px-3 rounded-lg flex items-center gap-2 text-sm font-medium transition-all cursor-pointer ${isActive ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30" : "bg-white/5 text-gray-400 hover:bg-white/8 hover:text-white"}`}
                                    >
                                        <span>{label}</span>
                                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showYearFilter ? "rotate-180" : ""}`} />
                                    </button>
                                    {showYearFilter && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowYearFilter(false)} />
                                            <div className="absolute top-full mt-2 left-0 z-20 bg-gray-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-2 min-w-36 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                                {yearOptions.map((opt) => {
                                                    const isSelected = filterYear === opt.value;
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => { setFilterYear(opt.value); syncUrl("year", opt.value === "All" ? null : opt.value); setShowYearFilter(false); }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${isSelected ? "bg-orange-500/20 text-orange-400" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
                                                        >
                                                            <span className="flex-1 text-left">{opt.label}</span>
                                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Thumbnail Style Toggle */}
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        onClick={() => {
                                            const next = thumbnailStyle === "poster" ? "backdrop" : "poster";
                                            setThumbnailStyle(next);
                                            localStorage.setItem("watchlist-thumbnail-style", next);
                                        }}
                                        className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center text-gray-400 hover:bg-white/8 hover:text-white transition-all cursor-pointer shrink-0"
                                    >
                                        {thumbnailStyle === "poster"
                                            ? <GalleryVertical className="h-4 w-4" />
                                            : <GalleryHorizontal className="h-4 w-4" />
                                        }
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                    {thumbnailStyle === "poster" ? "Switch to backdrop thumbnails" : "Switch to poster thumbnails"}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        {/* Actions Menu */}
                        {!readOnly && <div className="relative filter-dropdown shrink-0">
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
                                                handleRefreshMedia();
                                            }}
                                            disabled={isRefreshingMedia}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isRefreshingMedia ? "animate-spin" : ""}`} />
                                            {isRefreshingMedia ? "Refreshing..." : "Refresh TMDB Data"}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowActionsMenu(false);
                                                setMdlRefreshStatuses([]);
                                                setShowMdlRefreshModal(true);
                                            }}
                                            disabled={isRefreshingMdl}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isRefreshingMdl ? "animate-spin" : ""}`} />
                                            {isRefreshingMdl ? "Refreshing..." : "Refresh MDL Ratings"}
                                        </button>
                                        <div className="my-1 border-t border-white/5" />
                                        <button
                                            onClick={() => { setShowActionsMenu(false); exportCSV(); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                                        >
                                            <Download className="h-4 w-4" />
                                            Export as CSV
                                        </button>
                                        <button
                                            onClick={() => { setShowActionsMenu(false); exportJSON(); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                                        >
                                            <Download className="h-4 w-4" />
                                            Export as JSON
                                        </button>
                                        <button
                                            onClick={() => { setShowActionsMenu(false); importFileRef.current?.click(); }}
                                            disabled={isImportingJSON}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Upload className="h-4 w-4" />
                                            {isImportingJSON ? "Importing..." : "Import from JSON"}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-1 active-filters animate-in fade-in slide-in-from-top-1 duration-300">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filters:</span>
                    {filterStatuses.map((status) => (
                        <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-500/15 text-blue-400 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            {status}
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    ))}
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
                            onClick={() => { setFilterYear("All"); syncUrl("year", null); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white/10 text-gray-300 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            {filterYear}
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    )}
                    {filterAiringOnly && (
                        <button
                            onClick={() => { setFilterAiringOnly(false); syncUrl("airing", null); }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-400 hover:opacity-80 transition-all cursor-pointer group"
                        >
                            Airing
                            <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                        </button>
                    )}
                    <button
                        onClick={() => {
                            setFilterStatuses([]); setFilterCountries([]); setFilterGenres([]);
                            setFilterYear("All"); setFilterAiringOnly(false); setSearch("");
                            window.history.replaceState(null, "", window.location.pathname);
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
                                        className="item-card relative overflow-hidden rounded-2xl bg-white/2 cursor-pointer transition-all duration-300 hover:scale-[1.005]"
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        <div className="absolute inset-0 -z-10">
                                            {(first.backdrop || first.poster) && (
                                                <>
                                                    <Image unoptimized={true}
                                                        src={first.backdrop || first.poster!}
                                                        alt=""
                                                        fill
                                                        sizes="100vw"
                                                        className="object-cover opacity-30"
                                                        {...(displayedCount === 0 ? { priority: true } : { loading: "lazy" as const })}
                                                    />
                                                    <div className="absolute inset-0 bg-linear-to-r from-gray-900 via-gray-900/95 to-gray-900/80" />
                                                </>
                                            )}
                                        </div>
                                        <div className="relative flex items-center gap-3 p-2 parent-card-inner">
                                            {/* Thumbnail */}
                                            <div className={`relative shrink-0 rounded-lg overflow-hidden bg-gray-800/50 ${thumbnailStyle === "poster" ? "h-20 w-14" : "h-14 w-24"}`}>
                                                {(thumbnailStyle === "poster" ? first.poster || first.backdrop : first.backdrop || first.poster) ? (
                                                    <Image unoptimized={true}
                                                        src={thumbnailStyle === "poster" ? (first.poster || first.backdrop!) : (first.backdrop || first.poster!)}
                                                        alt={first.title || ""}
                                                        fill
                                                        sizes="192px"
                                                        className="object-cover"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                                                        <ImageOff className="h-5 w-5" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="text-base font-semibold text-white line-clamp-1">{first.title}</h3>
                                                    <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded flex items-center gap-1 shrink-0">
                                                        <Layers className="h-3 w-3" />{group.length} seasons
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <span>{first.originCountry || "Unknown"}</span>
                                                    <span className="w-1 h-1 rounded-full bg-gray-600" />
                                                    <span>{first.year || "N/A"}</span>
                                                </div>
                                            </div>

                                            <ChevronDown
                                                className={`h-5 w-5 text-gray-400 transition-transform duration-300 shrink-0 ${isExpanded ? "rotate-180" : ""}`}
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
                                                        readOnly={readOnly}
                                                        thumbnailStyle={thumbnailStyle}
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
                                        readOnly={readOnly}
                                        thumbnailStyle={thumbnailStyle}
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

            {!readOnly && editingItem && (
                <EditMediaDialog
                    key={editingItem.id}
                    item={editingItem}
                    open={editOpen}
                    onOpenChange={handleEditClose}
                    onOptimisticUpdate={handleOptimisticEdit}
                />
            )}

            {!readOnly && (
                <ConfirmDialog
                    open={confirmAction === "backfill"}
                    onOpenChange={(open) => !open && setConfirmAction(null)}
                    title="Refresh Backdrops"
                    description="This will refresh backdrops for all multi-season shows, assigning different images per season. Continue?"
                    confirmLabel="Refresh"
                    onConfirm={handleBackfill}
                />
            )}

            {!readOnly && (
                <Dialog open={showMdlRefreshModal} onOpenChange={setShowMdlRefreshModal}>
                    <DialogContent className="sm:max-w-md bg-gray-900 border-white/10">
                        <DialogHeader>
                            <DialogTitle className="text-white">Refresh MDL Ratings</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Select which statuses to refresh.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-wrap gap-2 py-2">
                            <button
                                onClick={() => setMdlRefreshStatuses([])}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                                    mdlRefreshStatuses.length === 0
                                        ? "bg-white/20 text-white"
                                        : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                All media
                            </button>
                            {allStatuses.map((status) => {
                                const cfg = statusConfig[status as keyof typeof statusConfig];
                                const Icon = cfg.icon;
                                const isSelected = mdlRefreshStatuses.includes(status);
                                return (
                                    <button
                                        key={status}
                                        onClick={() =>
                                            setMdlRefreshStatuses((prev) =>
                                                prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                                            )
                                        }
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
                                            isSelected
                                                ? `bg-white/15 ${cfg.color}`
                                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        {status}
                                    </button>
                                );
                            })}
                        </div>
                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setShowMdlRefreshModal(false)}
                                disabled={isRefreshingMdl}
                                className="cursor-pointer text-gray-400 hover:text-white hover:bg-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => handleRefreshMdlRatings(mdlRefreshStatuses)}
                                disabled={isRefreshingMdl}
                                className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                Start Refresh
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

const ItemCard = memo(function ItemCard({
    item,
    handleProgress,
    handleStatusChange,
    openEdit,
    isChild = false,
    readOnly = false,
    thumbnailStyle = "poster",
}: {
    item: WatchlistItem;
    handleProgress: (id: string, progress: number, title?: string) => void;
    handleStatusChange: (id: string, newStatus: string, title?: string) => void;
    openEdit: (item: WatchlistItem) => void;
    isChild?: boolean;
    readOnly?: boolean;
    thumbnailStyle?: "poster" | "backdrop";
}) {
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const [showCompletion, setShowCompletion] = useState(false);
    const [completionScore, setCompletionScore] = useState(0);
    const [completionSaving, setCompletionSaving] = useState(false);
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
                isChild ? "bg-white/3 border border-white/5" : "bg-white/2"
            }`}
        >
            {/* Backdrop with gradient overlay */}
            <div className="absolute inset-0 -z-10">
                {(item.backdrop || item.poster) ? (
                    <>
                        <Image unoptimized={true}
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
                    href={`/media/${item.source.toLowerCase()}-${item.externalId}${item.season > 1 ? `?season=${item.season}` : ""}`}
                    className={`card-image relative shrink-0 overflow-hidden rounded-lg transition-all duration-300 group-hover:ring-2 group-hover:ring-blue-500/30 ${
                        thumbnailStyle === "poster"
                            ? (isChild ? "h-14 w-10" : "h-20 w-14")
                            : (isChild ? "h-12 w-20" : "h-14 w-24")
                    } ${
                        (thumbnailStyle === "poster" ? item.poster || item.backdrop : item.backdrop || item.poster)
                            ? "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer"
                            : "bg-gray-800/50 border border-dashed border-gray-700"
                    }`}
                >
                    {(thumbnailStyle === "poster" ? item.poster || item.backdrop : item.backdrop || item.poster) ? (
                        <Image unoptimized={true}
                            src={thumbnailStyle === "poster" ? (item.poster || item.backdrop!) : (item.backdrop || item.poster!)}
                            alt={item.title || ""}
                            fill
                            sizes="112px"
                            className="object-fill transition-transform duration-500 group-hover:scale-105"
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
                                href={`/media/${item.source.toLowerCase()}-${item.externalId}${item.season > 1 ? `?season=${item.season}` : ""}`}
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
                        onClick={readOnly ? undefined : (e) => handleDropdownToggle(e, true)}
                        className={`mobile-status-btn items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusInfo.bg} ${statusInfo.border} border transition-opacity shrink-0 ${readOnly ? "" : "hover:opacity-80 cursor-pointer"}`}
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
                    onClick={readOnly ? undefined : (e) => handleDropdownToggle(e, false)}
                    className={`desktop-status-btn card-status flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${statusInfo.bg} ${statusInfo.border} border min-w-28 justify-center transition-all ${readOnly ? "" : "hover:opacity-80 cursor-pointer"}`}
                >
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className={`text-sm font-medium ${statusInfo.color}`}>{item.status}</span>
                </button>

                {!readOnly && showStatusDropdown &&
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

                {/* Completion dialog */}
                {showCompletion && typeof window !== "undefined" && createPortal(
                    <>
                        <div className="fixed inset-0 z-9998 bg-black/60 backdrop-blur-sm" onClick={() => setShowCompletion(false)} />
                        <div className="fixed z-9999 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-gray-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-white text-sm">All episodes watched!</p>
                                    <p className="text-xs text-gray-400 truncate max-w-56">{item.title}</p>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mb-3">Rate it before marking as completed</p>

                            <div className="grid grid-cols-10 gap-1 mb-2">
                                {[1,2,3,4,5,6,7,8,9,10].map((r) => (
                                    <div key={r} className="flex flex-col gap-0.5">
                                        <button
                                            onClick={() => setCompletionScore(completionScore === r ? 0 : r)}
                                            className={`cursor-pointer h-9 rounded-lg text-sm font-semibold transition-all ${
                                                completionScore === r
                                                    ? "bg-amber-500/30 text-amber-300 border border-amber-500/40"
                                                    : "bg-white/5 text-gray-500 hover:bg-white/10 hover:text-gray-300 border border-transparent"
                                            }`}
                                        >
                                            {r}
                                        </button>
                                        {r < 10 && (
                                            <button
                                                onClick={() => setCompletionScore(completionScore === r + 0.5 ? 0 : r + 0.5)}
                                                className={`cursor-pointer h-5 rounded text-[10px] font-medium transition-all ${
                                                    completionScore === r + 0.5
                                                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                                        : "text-gray-600 hover:text-gray-300 border border-transparent hover:bg-white/5"
                                                }`}
                                            >
                                                .5
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <p className="text-center text-xs text-gray-500 mb-5 h-4">
                                {completionScore > 0 ? `${completionScore}/10` : "No rating"}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowCompletion(false)}
                                    className="cursor-pointer flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                                >
                                    Skip
                                </button>
                                <button
                                    disabled={completionSaving}
                                    onClick={async () => {
                                        setCompletionSaving(true);
                                        try {
                                            await updateUserMedia(item.id, {
                                                status: "Completed",
                                                ...(completionScore > 0 ? { score: completionScore } : {}),
                                            });
                                            toast.success("Marked as completed", { description: item.title || undefined });
                                            setShowCompletion(false);
                                        } catch {
                                            toast.error("Failed to save");
                                        } finally {
                                            setCompletionSaving(false);
                                        }
                                    }}
                                    className="cursor-pointer flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                                >
                                    {completionSaving ? "Saving…" : "Complete"}
                                </button>
                            </div>
                        </div>
                    </>,
                    document.body,
                )}

                {/* Progress */}
                <div className="card-progress w-32 space-y-2">
                    <div className="flex items-center gap-1">
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleProgress(item.id, Math.max(0, item.progress - 1), item.title || undefined);
                                }}
                                className="progress-btn cursor-pointer h-7 w-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            >
                                <Minus className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <div className="flex-1 text-center text-sm">
                            <span className="font-semibold text-white tabular-nums">{item.progress}</span>
                            <span className="text-gray-600 mx-0.5">/</span>
                            <span className="text-gray-500 tabular-nums">{item.totalEp || "?"}</span>
                        </div>
                        {!readOnly && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const next = item.progress + 1;
                                    handleProgress(item.id, next, item.title || undefined);
                                    if (item.totalEp && next >= item.totalEp) {
                                        setCompletionScore(0);
                                        setShowCompletion(true);
                                    }
                                }}
                                className="progress-btn cursor-pointer h-7 w-7 flex items-center justify-center rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </button>
                        )}
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
                {!readOnly && (
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
                )}
            </div>
        </div>
    );
});
