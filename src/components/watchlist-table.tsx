"use client";

import { useState, useMemo, useRef, useOptimistic, useTransition, memo, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProgress, updateUserMedia } from "@/actions/media";
import { backfillBackdrops } from "@/actions/backfill";
import { Plus, Minus, Pencil, ChevronRight, Eye, CheckCircle, Clock, XCircle, RefreshCw, X, Filter } from "lucide-react";

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
    notes: string | null;
    season: number;
    mediaType: string;
    genres: string | null;
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

const statusConfig = {
    Watching: { icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    Completed: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    "Plan to Watch": { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    Dropped: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

// Generate a unique color overlay for each season based on season number
const getSeasonGradient = (seasonNumber: number): string => {
    // Calculate hue based on season number (distribute evenly across color wheel)
    const hue = (seasonNumber * 137.5) % 360; // Golden angle for good distribution
    // Subtle but visible: lower saturation (60%), moderate opacity (0.25 -> 0.08)
    return `linear-gradient(to right, hsla(${hue}, 60%, 50%, 0.25), hsla(${hue}, 60%, 50%, 0.08))`;
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
    const [showStatusFilter, setShowStatusFilter] = useState(false);
    const [showCountryFilter, setShowCountryFilter] = useState(false);
    const [showGenreFilter, setShowGenreFilter] = useState(false);

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
            // Multi-select status filter
            if (filterStatuses.length > 0 && !filterStatuses.includes(item.status)) return false;

            // Multi-select country filter
            if (filterCountries.length > 0 && (!item.originCountry || !filterCountries.includes(item.originCountry))) return false;

            // Multi-select genre filter
            if (filterGenres.length > 0) {
                if (!item.genres) return false;
                const itemGenres = item.genres.split(",").map((g) => g.trim());
                const hasMatchingGenre = filterGenres.some((fg) => itemGenres.includes(fg));
                if (!hasMatchingGenre) return false;
            }

            // Search filter
            if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false;

            // Year filter
            if (filterYear !== "All" && item.year) {
                if (filterYear === "2010s" && (item.year < 2010 || item.year >= 2020)) return false;
                if (filterYear === "2000s" && (item.year < 2000 || item.year >= 2010)) return false;
                if (filterYear === "Older" && item.year >= 2000) return false;
                if (!["2010s", "2000s", "Older"].includes(filterYear) && item.year.toString() !== filterYear) return false;
            }

            return true;
        });

        // Apply sorting
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

    // Helper functions for multi-select filters
    const toggleStatus = (status: string) => {
        setFilterStatuses((prev) => (prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]));
    };

    const toggleCountry = (country: string) => {
        setFilterCountries((prev) => (prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]));
    };

    const toggleGenre = (genre: string) => {
        setFilterGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]));
    };

    // Extract unique values for filters
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

    const handleProgress = useCallback(async (id: string, newProgress: number) => {
        startTransition(() => {
            setOptimisticItems({ id, progress: newProgress });
        });
        await updateProgress(id, newProgress);
    }, [startTransition, setOptimisticItems]);

    const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
        startTransition(() => {
            setOptimisticItems({ id, status: newStatus });
        });
        try {
            await updateUserMedia(id, { status: newStatus });
        } catch (error) {
            console.error("Failed to update status:", error);
        }
    }, [startTransition, setOptimisticItems]);

    const openEdit = useCallback((item: WatchlistItem) => {
        setEditingItem(item);
        setEditOpen(true);
    }, []);

    const handleEditClose = (isOpen: boolean) => {
        setEditOpen(isOpen);
        // Clear editing item when dialog closes to prevent glitches
        if (!isOpen) {
            // Small delay to allow dialog close animation to complete
            setTimeout(() => setEditingItem(null), 100);
        }
    };

    const handleOptimisticEdit = (id: string, updates: Partial<WatchlistItem>) => {
        startTransition(() => {
            setOptimisticItems({ id, ...updates });
        });
    };

    const handleBackfill = async () => {
        if (!confirm("This will fetch backdrops for all items missing them. Continue?")) return;

        setIsBackfilling(true);
        try {
            const result = await backfillBackdrops("mock-user-1");
            if (result.success) {
                alert(`Successfully updated ${result.count} items!`);
            }
        } catch (error) {
            console.error("Backfill failed:", error);
            alert("Failed to backfill. check console.");
        } finally {
            setIsBackfilling(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Filter Pills Row */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Status Filter Dropdown */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowStatusFilter(!showStatusFilter)}
                        className={`h-9 px-4 rounded-full border transition-all cursor-pointer ${
                            filterStatuses.length > 0
                                ? "bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        Status {filterStatuses.length > 0 && `(${filterStatuses.length})`}
                    </Button>
                    {showStatusFilter && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowStatusFilter(false)} />
                            <div className="absolute top-full mt-2 left-0 z-20 bg-gray-900 border border-white/10 rounded-lg shadow-xl p-2 min-w-[200px]">
                                {allStatuses.map((status) => {
                                    const Icon = statusConfig[status as keyof typeof statusConfig]?.icon;
                                    const config = statusConfig[status as keyof typeof statusConfig];
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => toggleStatus(status)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                                                filterStatuses.includes(status)
                                                    ? `${config?.bg} ${config?.color} ${config?.border} border`
                                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Country Filter Dropdown */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowCountryFilter(!showCountryFilter)}
                        className={`h-9 px-4 rounded-full border transition-all cursor-pointer ${
                            filterCountries.length > 0
                                ? "bg-purple-500/20 border-purple-500/50 text-purple-400 hover:bg-purple-500/30"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        Country {filterCountries.length > 0 && `(${filterCountries.length})`}
                    </Button>
                    {showCountryFilter && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowCountryFilter(false)} />
                            <div className="absolute top-full mt-2 left-0 z-20 bg-gray-900 border border-white/10 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                                {allCountries.map((country) => (
                                    <button
                                        key={country}
                                        onClick={() => toggleCountry(country)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                                            filterCountries.includes(country)
                                                ? "bg-purple-500/20 text-purple-400 border border-purple-500/50"
                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {country}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Genre Filter Dropdown */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowGenreFilter(!showGenreFilter)}
                        className={`h-9 px-4 rounded-full border transition-all cursor-pointer ${
                            filterGenres.length > 0
                                ? "bg-green-500/20 border-green-500/50 text-green-400 hover:bg-green-500/30"
                                : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <Filter className="h-3.5 w-3.5 mr-2" />
                        Genre {filterGenres.length > 0 && `(${filterGenres.length})`}
                    </Button>
                    {showGenreFilter && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowGenreFilter(false)} />
                            <div className="absolute top-full mt-2 left-0 z-20 bg-gray-900 border border-white/10 rounded-lg shadow-xl p-2 min-w-[200px] max-h-[300px] overflow-y-auto">
                                {allGenres.map((genre) => (
                                    <button
                                        key={genre}
                                        onClick={() => toggleGenre(genre)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${
                                            filterGenres.includes(genre)
                                                ? "bg-green-500/20 text-green-400 border border-green-500/50"
                                                : "text-gray-400 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {genre}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Sort Dropdown */}
                <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="h-9 px-4 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm hover:border-white/20 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                    <option value="default" className="bg-gray-900">
                        Sort: Default
                    </option>
                    <option value="rating-high" className="bg-gray-900">
                        Rating: High to Low
                    </option>
                    <option value="rating-low" className="bg-gray-900">
                        Rating: Low to High
                    </option>
                    <option value="progress-high" className="bg-gray-900">
                        Progress: High to Low
                    </option>
                    <option value="progress-low" className="bg-gray-900">
                        Progress: Low to High
                    </option>
                    <option value="title-az" className="bg-gray-900">
                        Title: A-Z
                    </option>
                    <option value="title-za" className="bg-gray-900">
                        Title: Z-A
                    </option>
                    <option value="year-new" className="bg-gray-900">
                        Year: Newest
                    </option>
                    <option value="year-old" className="bg-gray-900">
                        Year: Oldest
                    </option>
                </select>

                {/* Year Dropdown */}
                <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                    className="h-9 px-4 rounded-full bg-white/5 border border-white/10 text-gray-300 text-sm hover:border-white/20 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                    <option value="All" className="bg-gray-900">
                        All Years
                    </option>
                    {Array.from({ length: new Date().getFullYear() - 2020 + 1 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                        <option key={year} value={year} className="bg-gray-900">
                            {year}
                        </option>
                    ))}
                    <option value="2010s" className="bg-gray-900">
                        2010-2019
                    </option>
                    <option value="2000s" className="bg-gray-900">
                        2000-2009
                    </option>
                    <option value="Older" className="bg-gray-900">
                        Before 2000
                    </option>
                </select>

                {/* Search */}
                <div className="flex-1 min-w-[200px] relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-full blur opacity-0 group-hover:opacity-20 transition duration-500" />
                    <Input
                        placeholder="Search titles..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="relative w-full h-9 bg-white/5 border-white/10 rounded-full text-white placeholder:text-muted-foreground/50 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                    />
                </div>

                {/* Backfill Button */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackfill}
                    disabled={isBackfilling}
                    className="h-9 px-4 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-all gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} />
                    {isBackfilling ? "Processing..." : "Refresh Backdrops"}
                </Button>
            </div>

            {/* Active Filter Pills */}
            {(filterStatuses.length > 0 || filterCountries.length > 0 || filterGenres.length > 0) && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">Active filters:</span>
                    {filterStatuses.map((status) => (
                        <button
                            key={status}
                            onClick={() => toggleStatus(status)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/20 border border-blue-500/50 text-blue-400 rounded-full text-sm hover:bg-blue-500/30 transition-all group"
                        >
                            {status}
                            <X className="h-3 w-3 group-hover:text-blue-300" />
                        </button>
                    ))}
                    {filterCountries.map((country) => (
                        <button
                            key={country}
                            onClick={() => toggleCountry(country)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 border border-purple-500/50 text-purple-400 rounded-full text-sm hover:bg-purple-500/30 transition-all group"
                        >
                            {country}
                            <X className="h-3 w-3 group-hover:text-purple-300" />
                        </button>
                    ))}
                    {filterGenres.map((genre) => (
                        <button
                            key={genre}
                            onClick={() => toggleGenre(genre)}
                            className="flex items-center gap-1.5 px-3 py-1 bg-green-500/20 border border-green-500/50 text-green-400 rounded-full text-sm hover:bg-green-500/30 transition-all group"
                        >
                            {genre}
                            <X className="h-3 w-3 group-hover:text-green-300" />
                        </button>
                    ))}
                    {(filterStatuses.length > 0 || filterCountries.length > 0 || filterGenres.length > 0) && (
                        <button
                            onClick={() => {
                                setFilterStatuses([]);
                                setFilterCountries([]);
                                setFilterGenres([]);
                            }}
                            className="px-3 py-1 bg-red-500/20 border border-red-500/50 text-red-400 rounded-full text-sm hover:bg-red-500/30 transition-all"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            )}

            <div className="space-y-2">
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
                    groupOrder.forEach((groupKey) => {
                        const group = groupedItems[groupKey];
                        group.sort((a, b) => a.season - b.season);
                        const first = group[0];
                        const isMultiSeason = group.length > 1;
                        const isExpanded = expandedGroups.has(groupKey);

                        if (isMultiSeason) {
                            // Parent Card
                            resultNodes.push(
                                <div
                                    key={`group-${groupKey}`}
                                    className="group relative bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm rounded-lg border border-white/10 hover:border-white/20 transition-all cursor-pointer overflow-hidden hover:shadow-xl hover:shadow-black/30 shadow-md shadow-black/20"
                                    onClick={() => toggleGroup(groupKey)}
                                    style={{
                                        boxShadow:
                                            "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
                                    }}
                                >
                                    <div className="flex items-center gap-5 p-5">
                                        <div
                                            className={`relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md shadow-lg ${
                                                first.backdrop || first.poster
                                                    ? "bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-shimmer"
                                                    : "bg-gray-800"
                                            }`}
                                        >
                                            {(first.backdrop || first.poster) && (
                                                <Image
                                                    src={first.backdrop || first.poster!}
                                                    alt={first.title || ""}
                                                    fill
                                                    className="object-cover opacity-0 transition-all duration-500"
                                                    loading="lazy"
                                                    onLoad={(e) => {
                                                        e.currentTarget.classList.replace("opacity-0", "opacity-100");
                                                        e.currentTarget.parentElement?.classList.remove("animate-shimmer");
                                                    }}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-xl text-white">{first.title}</div>
                                            <div className="text-sm text-gray-400 mt-1">{group.length} seasons</div>
                                        </div>
                                        <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    </div>
                                </div>,
                            );

                            // Child Cards
                            if (isExpanded) {
                                group.forEach((item, index) => {
                                    resultNodes.push(
                                        <div
                                            key={item.id}
                                            className="ml-8 animate-slide-down-row opacity-0"
                                            style={{ animationDelay: `${index * 80}ms` }}
                                        >
                                            <ItemCard
                                                item={item}
                                                handleProgress={handleProgress}
                                                handleStatusChange={handleStatusChange}
                                                openEdit={openEdit}
                                                isChild={true}
                                            />
                                        </div>,
                                    );
                                });
                            }
                        } else {
                            // Single Card
                            resultNodes.push(
                                <ItemCard
                                    key={first.id}
                                    item={first}
                                    handleProgress={handleProgress}
                                    handleStatusChange={handleStatusChange}
                                    openEdit={openEdit}
                                />,
                            );
                        }
                    });

                    return resultNodes;
                })()}

                {filteredItems.length === 0 && (
                    <div className="p-12 text-center">
                        <div className="text-gray-400 text-lg">No items found</div>
                        <div className="text-gray-500 text-sm mt-2">Try adjusting your filters</div>
                    </div>
                )}
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
    handleProgress: (id: string, progress: number) => void;
    handleStatusChange: (id: string, newStatus: string) => void;
    openEdit: (item: WatchlistItem) => void;
    isChild?: boolean;
}) {
    const [showStatusDropdown, setShowStatusDropdown] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const statusInfo = statusConfig[item.status as keyof typeof statusConfig] || statusConfig["Plan to Watch"];
    const StatusIcon = statusInfo.icon;
    const progressPercent = item.totalEp ? (item.progress / item.totalEp) * 100 : 0;
    const allStatuses = ["Watching", "Completed", "Plan to Watch", "Dropped"];

    const handleDropdownToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showStatusDropdown && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + 8,
                left: rect.right - 180, // Align to right edge
            });
        }
        setShowStatusDropdown(!showStatusDropdown);
    };

    return (
        <div
            className={`group relative backdrop-blur-sm rounded-lg border transition-all hover:shadow-xl hover:shadow-black/30 shadow-md shadow-black/20 ${
                isChild
                    ? "bg-gradient-to-br from-blue-500/[0.08] to-blue-500/[0.03] border-blue-500/20 hover:border-blue-500/40"
                    : "bg-gradient-to-br from-white/[0.05] to-white/[0.01] border-white/10 hover:border-white/20"
            }`}
            style={{
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
            }}
        >
            <div className="flex items-center gap-5 px-5 py-3">
                <Link
                    href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                    className={`relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md hover:ring-2 hover:ring-white/20 transition-all shadow-lg ${
                        item.backdrop || item.poster
                            ? "bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%] animate-shimmer"
                            : "bg-gray-800"
                    }`}
                >
                    {(item.backdrop || item.poster) && (
                        <>
                            <Image
                                src={item.backdrop || item.poster!}
                                alt={item.title || ""}
                                fill
                                className="object-cover opacity-0 transition-all duration-500"
                                loading="lazy"
                                onLoad={(e) => {
                                    e.currentTarget.classList.replace("opacity-0", "opacity-100");
                                    e.currentTarget.parentElement?.classList.remove("animate-shimmer");
                                }}
                            />
                            {/* Season color overlay - only show if this is a child (season) card */}
                            {isChild && (
                                <div className="absolute inset-0 pointer-events-none" style={{ background: getSeasonGradient(item.season) }} />
                            )}
                        </>
                    )}
                </Link>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <Link
                            href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                            className="font-semibold text-xl text-white hover:text-blue-400 transition-colors line-clamp-1"
                        >
                            {item.title}
                        </Link>
                        {item.mediaType === "TV" && item.season > 0 && (
                            <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded">S{item.season}</span>
                        )}
                    </div>
                    <div className="text-sm text-gray-400">
                        {item.originCountry || "Unknown"} · {item.year || "N/A"}
                    </div>
                </div>

                {/* Status Dropdown */}
                <button
                    ref={buttonRef}
                    onClick={handleDropdownToggle}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bg} border ${statusInfo.border} min-w-[140px] justify-center hover:opacity-80 transition-opacity cursor-pointer`}
                >
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className={`text-sm font-medium ${statusInfo.color}`}>{item.status}</span>
                </button>

                {showStatusDropdown &&
                    typeof window !== "undefined" &&
                    createPortal(
                        <>
                            <div className="fixed inset-0 z-[9998]" onClick={() => setShowStatusDropdown(false)} />
                            <div
                                className="fixed z-[9999] bg-gray-900 border border-white/10 rounded-lg shadow-xl p-2 min-w-[180px]"
                                style={{
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                }}
                            >
                                {allStatuses.map((status) => {
                                    const config = statusConfig[status as keyof typeof statusConfig];
                                    const Icon = config?.icon;
                                    return (
                                        <button
                                            key={status}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleStatusChange(item.id, status);
                                                setShowStatusDropdown(false);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
                                                item.status === status
                                                    ? `${config?.bg} ${config?.color} ${config?.border} border`
                                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            {Icon && <Icon className="h-4 w-4" />}
                                            {status}
                                        </button>
                                    );
                                })}
                            </div>
                        </>,
                        document.body,
                    )}

                <div className="w-42 space-y-2">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleProgress(item.id, Math.max(0, item.progress - 1));
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <Minus className="h-4 w-4" />
                        </button>
                        <div className="flex-1 text-center">
                            <span className="font-semibold text-white text-lg">{item.progress}</span>
                            <span className="text-gray-500"> / </span>
                            <span className="text-gray-400">{item.totalEp || "?"}</span>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleProgress(item.id, item.progress + 1);
                            }}
                            className="h-7 w-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="relative h-2 bg-black/30 rounded-full overflow-hidden">
                        <div
                            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                                item.status === "Completed"
                                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                    : "bg-gradient-to-r from-blue-500 to-cyan-500"
                            }`}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5 w-20 justify-center">
                    {item.score ? (
                        <>
                            <svg className="h-5 w-5 text-yellow-500 fill-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                />
                            </svg>
                            <span className="text-white font-semibold">{item.score.toFixed(1)}</span>
                        </>
                    ) : (
                        <span className="text-gray-500 text-sm">No rating</span>
                    )}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                        e.stopPropagation();
                        openEdit(item);
                    }}
                    className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </div>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
    );
});
