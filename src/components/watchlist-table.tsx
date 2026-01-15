"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateProgress } from "@/actions/media";
import { backfillBackdrops } from "@/actions/backfill";
import { Plus, Minus, Pencil, ChevronRight, ChevronDown, Eye, CheckCircle, Clock, XCircle, RefreshCw } from "lucide-react";

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
};

interface WatchlistTableProps {
    items: WatchlistItem[];
}

import { EditMediaDialog } from "./edit-media-dialog";

const statusConfig = {
    Watching: { icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    Completed: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
    "Plan to Watch": { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
    Dropped: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export function WatchlistTable({ items }: WatchlistTableProps) {
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [filterCountry, setFilterCountry] = useState<string>("All");
    const [filterYear, setFilterYear] = useState<string>("All");
    const [search, setSearch] = useState("");
    const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<string>("default");
    const [isBackfilling, setIsBackfilling] = useState(false);

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
        let result = items.filter((item) => {
            if (filterStatus !== "All" && item.status !== filterStatus) return false;
            if (filterCountry !== "All" && item.originCountry !== filterCountry) return false;
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
    }, [items, filterStatus, filterCountry, search, filterYear, sortBy]);

    const handleProgress = async (id: string, newProgress: number) => {
        await updateProgress(id, newProgress);
    };

    const openEdit = (item: WatchlistItem) => {
        setEditingItem(item);
        setEditOpen(true);
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
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2 p-1 bg-black/20 backdrop-blur-sm rounded-lg border border-white/5">
                    {["All", "Watching", "Completed", "Plan to Watch", "Dropped"].map((s) => (
                        <Button
                            key={s}
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterStatus(s)}
                            className={`rounded-md px-4 transition-all ${
                                filterStatus === s
                                    ? "bg-blue-500 text-white hover:bg-blue-600"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            }`}
                        >
                            {s}
                        </Button>
                    ))}
                </div>

                <div className="flex gap-3 p-1 bg-black/20 backdrop-blur-sm rounded-lg border border-white/5">

                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-transparent text-gray-300 text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/20 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                    >
                        <option value="default" className="bg-gray-900">Sort by: Default</option>
                        <option value="rating-high" className="bg-gray-900">Rating: High to Low</option>
                        <option value="rating-low" className="bg-gray-900">Rating: Low to High</option>
                        <option value="progress-high" className="bg-gray-900">Progress: High to Low</option>
                        <option value="progress-low" className="bg-gray-900">Progress: Low to High</option>
                        <option value="title-az" className="bg-gray-900">Title: A-Z</option>
                        <option value="title-za" className="bg-gray-900">Title: Z-A</option>
                        <option value="year-new" className="bg-gray-900">Year: Newest</option>
                        <option value="year-old" className="bg-gray-900">Year: Oldest</option>
                    </select>

                    <select
                        value={filterCountry}
                        onChange={(e) => setFilterCountry(e.target.value)}
                        className="bg-transparent text-gray-300 text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/20 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                    >
                        <option value="All" className="bg-gray-900">All Countries</option>
                        {Array.from(new Set(items.map(item => item.originCountry).filter(Boolean))).sort().map(country => (
                            <option key={country} value={country!} className="bg-gray-900">{country}</option>
                        ))}
                    </select>

                    <select
                        value={filterYear}
                        onChange={(e) => setFilterYear(e.target.value)}
                        className="bg-transparent text-gray-300 text-sm px-3 py-2 rounded-md border border-white/10 hover:border-white/20 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                    >
                        <option value="All" className="bg-gray-900">All Years</option>
                        <option value="2025" className="bg-gray-900">2025</option>
                        <option value="2024" className="bg-gray-900">2024</option>
                        <option value="2023" className="bg-gray-900">2023</option>
                        <option value="2022" className="bg-gray-900">2022</option>
                        <option value="2021" className="bg-gray-900">2021</option>
                        <option value="2020" className="bg-gray-900">2020</option>
                        <option value="2010s" className="bg-gray-900">2010-2019</option>
                        <option value="2000s" className="bg-gray-900">2000-2009</option>
                        <option value="Older" className="bg-gray-900">Before 2000</option>
                    </select>
                </div>
                <div className="flex-1 min-w-[200px] relative group flex gap-3">
                    <div className="relative flex-1 group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-xl blur opacity-0 group-hover:opacity-20 transition duration-500" />
                        <Input
                            placeholder="Search titles..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="relative w-full h-10 bg-white/5 border-white/5 rounded-xl text-white placeholder:text-muted-foreground/50 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:border-primary/50 transition-all"
                        />
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBackfill}
                    disabled={isBackfilling}
                    className="cursor-pointer h-10 px-4 bg-white/5 border border-white/5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${isBackfilling ? "animate-spin" : ""}`} />
                    {isBackfilling ? "Processing..." : "Refresh Backdrops"}
                </Button>

            </div>


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
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
                                    }}
                                >
                                    <div className="flex items-center gap-5 p-5">
                                        <div className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md bg-black/20 shadow-lg">
    {(first.backdrop || first.poster) && (
        <Image src={first.backdrop || first.poster!} alt={first.title || ""} fill className="object-cover" />
    )}
</div>
                                        <div className="flex-1">
                                            <div className="font-semibold text-xl text-white">{first.title}</div>
                                            <div className="text-sm text-gray-400 mt-1">
                                                {group.length} seasons
                                            </div>
                                        </div>
                                        <ChevronRight
                                            className={`h-5 w-5 text-gray-400 transition-transform ${
                                                isExpanded ? "rotate-90" : ""
                                            }`}
                                        />
                                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                    </div>
                                </div>
                            );

                            // Child Cards
                            if (isExpanded) {
                                group.forEach((item) => {
                                    resultNodes.push(
                                        <ItemCard
                                            key={item.id}
                                            item={item}
                                            handleProgress={handleProgress}
                                            openEdit={openEdit}
                                            isChild={true}
                                        />
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
                                    openEdit={openEdit}
                                />
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

            {editingItem && <EditMediaDialog key={editingItem.id} item={editingItem} open={editOpen} onOpenChange={setEditOpen} />}
        </div>
    );
}

function ItemCard({
    item,
    handleProgress,
    openEdit,
    isChild = false,
}: {
    item: WatchlistItem;
    handleProgress: (id: string, progress: number) => void;
    openEdit: (item: WatchlistItem) => void;
    isChild?: boolean;
}) {
    const statusInfo = statusConfig[item.status as keyof typeof statusConfig] || statusConfig["Plan to Watch"];
    const StatusIcon = statusInfo.icon;
    const progressPercent = item.totalEp ? (item.progress / item.totalEp) * 100 : 0;

    return (
        <div className={`group relative bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm rounded-lg border border-white/10 hover:border-white/20 transition-all overflow-hidden hover:shadow-xl hover:shadow-black/30 shadow-md shadow-black/20 ${
                isChild ? "ml-8" : ""
            }`}
            style={{
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
            }}
        >
            <div className="flex items-center gap-5 px-5 py-3">
                <Link
                    href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                    className="relative h-20 w-32 flex-shrink-0 overflow-hidden rounded-md bg-black/20 hover:ring-2 hover:ring-white/20 transition-all shadow-lg"
                >
                    {(item.backdrop || item.poster) && <Image src={item.backdrop || item.poster!} alt={item.title || ""} fill className="object-cover" />}
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
                            <span className="text-xs font-medium text-gray-400 bg-white/5 px-2 py-1 rounded">
                                S{item.season}
                            </span>
                        )}
                    </div>
                    <div className="text-sm text-gray-400">
                        {item.originCountry || "Unknown"} · {item.year || "N/A"}
                    </div>
                </div>

                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.bg} border ${statusInfo.border}`}>
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className={`text-sm font-medium ${statusInfo.color}`}>{item.status}</span>
                </div>

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
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    {item.score ? (
                        <>
                            <svg
                                className="h-5 w-5 text-yellow-500 fill-yellow-500"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
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
}
