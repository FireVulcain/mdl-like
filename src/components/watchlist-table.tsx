"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { updateProgress } from "@/actions/media";
import { Plus, Minus, Pencil, ChevronRight, ChevronDown, ArrowUpDown, ChevronUp } from "lucide-react";

type WatchlistItem = {
    id: string;
    source: string;
    externalId: string;
    title: string | null;
    poster: string | null;
    year: number | null;
    originCountry: string | null;
    status: string;
    progress: number;
    totalEp: number | null;
    score: number | null;
    notes: string | null;
    season: number; // Default 1
    mediaType: string;
};

interface WatchlistTableProps {
    items: WatchlistItem[];
}

import { EditMediaDialog } from "./edit-media-dialog";

type SortConfig = {
    key: keyof WatchlistItem | null;
    direction: "asc" | "desc";
};

export function WatchlistTable({ items }: WatchlistTableProps) {
    const [filterStatus, setFilterStatus] = useState<string>("All");
    const [filterCountry, setFilterCountry] = useState<string>("All");
    const [search, setSearch] = useState("");
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: "asc" });

    const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (key: string) => {
        const newSet = new Set(expandedGroups);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedGroups(newSet);
    };

    const handleSort = (key: keyof WatchlistItem) => {
        let direction: "asc" | "desc" = "asc";
        if (sortConfig.key === key && sortConfig.direction === "asc") {
            direction = "desc";
        } else if (sortConfig.key === key && sortConfig.direction === "desc") {
            setSortConfig({ key: null, direction: "asc" });
            return;
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedItems = useMemo(() => {
        let result = items.filter((item) => {
            if (filterStatus !== "All" && item.status !== filterStatus) return false;
            if (filterCountry !== "All" && item.originCountry !== filterCountry) return false;
            if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key!];
                const bValue = b[sortConfig.key!];

                if (aValue === null) return 1;
                if (bValue === null) return -1;

                if (aValue < bValue) {
                    return sortConfig.direction === "asc" ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === "asc" ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [items, filterStatus, search, sortConfig]);

    const handleProgress = async (id: string, newProgress: number) => {
        await updateProgress(id, newProgress);
    };

    const openEdit = (item: WatchlistItem) => {
        setEditingItem(item);
        setEditOpen(true);
    };

    const SortIcon = ({ column }: { column: keyof WatchlistItem }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-3 w-3" />;
        return sortConfig.direction === "asc" ? <ChevronUp className="ml-2 h-3 w-3" /> : <ChevronDown className="ml-2 h-3 w-3" />;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-4 p-4 bg-card border rounded-lg">
                <div className="flex gap-2">
                    {["All", "Watching", "Completed", "Plan to Watch", "Dropped"].map((s) => (
                        <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" onClick={() => setFilterStatus(s)}>
                            {s}
                        </Button>
                    ))}
                </div>
                <div className="flex-1">
                    <Input placeholder="Filter by title..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                <table className="w-full text-base text-left border-collapse">
                    <thead className="bg-[#2490da] text-white font-medium">
                        <tr>
                            <th className="p-3 w-12 text-center  border-[#ffffff20]">#</th>
                            <th
                                className="p-3 cursor-pointer hover:bg-[#1e78b8] transition-colors  border-[#ffffff20]"
                                onClick={() => handleSort("title")}
                            >
                                <div className="flex items-center">
                                    Title <SortIcon column="title" />
                                </div>
                            </th>
                            <th
                                className="p-3 w-32 cursor-pointer hover:bg-[#1e78b8] transition-colors  border-[#ffffff20]"
                                onClick={() => handleSort("status")}
                            >
                                <div className="flex items-center">
                                    Status <SortIcon column="status" />
                                </div>
                            </th>
                            <th
                                className="p-3 w-32 cursor-pointer hover:bg-[#1e78b8] transition-colors  border-[#ffffff20]"
                                onClick={() => handleSort("originCountry")}
                            >
                                <div className="flex items-center">
                                    Country <SortIcon column="originCountry" />
                                </div>
                            </th>
                            <th
                                className="p-3 w-24 cursor-pointer hover:bg-[#1e78b8] transition-colors  border-[#ffffff20]"
                                onClick={() => handleSort("year")}
                            >
                                <div className="flex items-center">
                                    Year <SortIcon column="year" />
                                </div>
                            </th>
                            <th
                                className="p-3 w-40 cursor-pointer hover:bg-[#1e78b8] transition-colors  border-[#ffffff20]"
                                onClick={() => handleSort("progress")}
                            >
                                <div className="flex items-center">
                                    Progress <SortIcon column="progress" />
                                </div>
                            </th>
                            <th
                                className="p-3 w-24 cursor-pointer hover:bg-[#1e78b8] transition-colors text-right  border-[#ffffff20]"
                                onClick={() => handleSort("score")}
                            >
                                <div className="flex items-center justify-end">
                                    Score <SortIcon column="score" />
                                </div>
                            </th>
                            <th className="p-3 w-12"></th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-border">
                        {(() => {
                            // First, identify which shows have any season in "Watching" status
                            const showsWithWatchingSeason = new Set<string>();
                            filteredAndSortedItems.forEach((item) => {
                                if (item.status === "Watching") {
                                    showsWithWatchingSeason.add(`${item.source}-${item.externalId}`);
                                }
                            });

                            const groupedItems: { [key: string]: WatchlistItem[] } = {};
                            const groupOrder: string[] = [];

                            filteredAndSortedItems.forEach((item) => {
                                const baseKey = `${item.source}-${item.externalId}`;
                                const hasWatching = showsWithWatchingSeason.has(baseKey);

                                // Logic refinement:
                                // 1. If no season is "Watching", group everything under baseKey.
                                // 2. If at least one is "Watching":
                                //    - Group all "Completed" seasons together under baseKey-completed.
                                //    - Keep every other season individual under baseKey-season.
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
                            groupOrder.forEach((groupKey, groupIndex) => {
                                const group = groupedItems[groupKey];
                                group.sort((a, b) => a.season - b.season);
                                const first = group[0];
                                const isMultiSeason = group.length > 1;
                                const isExpanded = expandedGroups.has(groupKey);

                                if (isMultiSeason) {
                                    const isCompletedGroup = groupKey.endsWith("-completed");

                                    // Render Parent Row
                                    resultNodes.push(
                                        <tr
                                            key={`group-${groupKey}`}
                                            className={`group transition-all cursor-pointer border-l-4 ${
                                                isExpanded
                                                    ? "bg-primary/5 border-l-[#ffffff20]"
                                                    : "odd:bg-muted/5 even:bg-transparent hover:bg-muted/10 border-l-transparent"
                                            }`}
                                            onClick={() => toggleGroup(groupKey)}
                                        >
                                            <td className="p-3 text-center text-muted-foreground align-middle ">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-6 w-6 transition-transform ${isExpanded ? "text-primary bg-primary/10" : ""}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleGroup(groupKey);
                                                    }}
                                                >
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </Button>
                                            </td>
                                            <td className="p-3 ">
                                                <div className="flex gap-3 items-center">
                                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-secondary">
                                                        {first.poster ? (
                                                            <Image src={first.poster} alt={first.title || ""} fill className="object-cover" />
                                                        ) : null}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold">{first.title}</div>
                                                        <div
                                                            className={`text-xs ${
                                                                isCompletedGroup ? "text-primary font-medium" : "text-muted-foreground"
                                                            }`}
                                                        >
                                                            {isCompletedGroup ? "Completed Seasons" : "Show All Seasons"} ({group.length})
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3" colSpan={6}>
                                                <div className="text-base text-muted-foreground italic flex items-center gap-2">
                                                    <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                    {isExpanded ? "Click to collapse" : `Click to view ${group.length} seasons`}
                                                </div>
                                            </td>
                                        </tr>
                                    );

                                    // Render Children if Expanded
                                    if (isExpanded) {
                                        group.forEach((item, index) => {
                                            const isLast = index === group.length - 1;
                                            resultNodes.push(
                                                <tr
                                                    key={item.id}
                                                    className={`transition-colors border-l-4 border-l-[#ffffff20] bg-primary/[0.03] hover:bg-primary/[0.08] animate-slide-down-row opacity-0 ${
                                                        isLast ? "border-b-4 border-b-[#ffffff20]" : "border-b border-muted/30"
                                                    }`}
                                                    style={{ animationDelay: `${index * 50}ms` }}
                                                >
                                                    <td className="p-3 text-center text-muted-foreground w-12 relative">
                                                        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-primary/20 -translate-x-1/2"></div>
                                                        {!isLast && (
                                                            <div className="absolute left-[calc(50%+1px)] bottom-0 w-2 h-[2px] bg-primary/20"></div>
                                                        )}
                                                    </td>
                                                    <td className="p-3 pl-8 ">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
                                                                Season {item.season}
                                                            </span>
                                                            <Link
                                                                href={`/media/${item.source.toLowerCase()}-${item.externalId}?season=${item.season}`}
                                                                className="text-base hover:underline text-muted-foreground hover:text-foreground"
                                                            >
                                                                View Details
                                                            </Link>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 ">
                                                        <Badge
                                                            variant={item.status === "Watching" ? "default" : "secondary"}
                                                            className="rounded-full font-normal scale-90 origin-left"
                                                        >
                                                            {item.status}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3 text-muted-foreground text-base ">{item.originCountry || "-"}</td>
                                                    <td className="p-3 text-muted-foreground text-base ">{item.year || "-"}</td>
                                                    <td className="p-3 ">
                                                        <div className="flex items-center origin-left">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleProgress(item.id, Math.max(0, item.progress - 1));
                                                                }}
                                                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                                            >
                                                                <Minus className="h-3 w-3" />
                                                            </button>
                                                            <span className="font-medium w-full text-center text-foreground text-base">
                                                                {item.progress} <span className="text-muted-foreground">/ {item.totalEp || "?"}</span>
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleProgress(item.id, item.progress + 1);
                                                                }}
                                                                className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                                            >
                                                                <Plus className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                        {item.totalEp && (
                                                            <Progress value={(item.progress / item.totalEp) * 100} className="h-1 mt-1 w-full" />
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-right font-medium text-yellow-500 text-base ">
                                                        {item.score ? item.score.toFixed(1) : "-"}
                                                    </td>
                                                    <td className="p-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openEdit(item);
                                                            }}
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    }
                                } else {
                                    // Single Item Render
                                    const item = first;
                                    resultNodes.push(
                                        <tr key={item.id} className="group odd:bg-muted/5 even:bg-transparent hover:bg-muted/10 transition-colors">
                                            <td className="p-3 text-center text-muted-foreground ">{groupIndex + 1}</td>
                                            <td className="p-3 ">
                                                <div className="flex gap-3 items-center">
                                                    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-secondary">
                                                        {item.poster ? (
                                                            <Link
                                                                href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                                                                className="hover:underline"
                                                            >
                                                                <Image src={item.poster} alt={item.title || ""} fill className="object-cover" />
                                                            </Link>
                                                        ) : null}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold line-clamp-1">
                                                            <Link
                                                                href={`/media/${item.source.toLowerCase()}-${item.externalId}`}
                                                                className="hover:underline"
                                                            >
                                                                {item.title}
                                                            </Link>
                                                            {item.mediaType === "TV" && item.season > 0 && (
                                                                <span className="ml-2 text-xs font-normal text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                                                                    S{item.season}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-3 ">
                                                <Badge
                                                    variant={item.status === "Watching" ? "default" : "secondary"}
                                                    className="rounded-full font-normal"
                                                >
                                                    {item.status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-muted-foreground ">{item.originCountry || "-"}</td>
                                            <td className="p-3 text-muted-foreground ">{item.year || "-"}</td>
                                            <td className="p-3 ">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleProgress(item.id, Math.max(0, item.progress - 1))}
                                                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                                    >
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="font-medium w-full text-center text-foreground">
                                                        {item.progress} <span className="text-muted-foreground">/ {item.totalEp || "?"}</span>
                                                    </span>
                                                    <button
                                                        onClick={() => handleProgress(item.id, item.progress + 1)}
                                                        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground"
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                {item.totalEp && <Progress value={(item.progress / item.totalEp) * 100} className="h-1 mt-1" />}
                                            </td>
                                            <td className="p-3 text-right font-medium text-yellow-500 ">
                                                {item.score ? item.score.toFixed(1) : "-"}
                                            </td>
                                            <td className="p-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEdit(item)}
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                }
                            });

                            return resultNodes;
                        })()}
                    </tbody>
                </table>
                {filteredAndSortedItems.length === 0 && <div className="p-8 text-center text-muted-foreground">No items found.</div>}
            </div>

            {editingItem && <EditMediaDialog key={editingItem.id} item={editingItem} open={editOpen} onOpenChange={setEditOpen} />}
        </div>
    );
}
