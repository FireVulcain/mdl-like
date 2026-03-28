"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { MediaCard } from "@/components/media-card";
import { fetchMdlSearchResults, fetchMoreMedia } from "@/app/search/actions";
import type { UnifiedMedia } from "@/services/media.service";

const COUNTRY_LABELS: Record<string, string> = {
    KR: "Korea",
    CN: "China",
    TW: "Taiwan",
    HK: "Hong Kong",
    MO: "Macau",
    JP: "Japan",
    TH: "Thailand",
    US: "USA",
    GB: "UK",
    FR: "France",
    IN: "India",
    PH: "Philippines",
    SG: "Singapore",
    ID: "Indonesia",
};

export function SearchMediaGrid({
    media,
    query,
    totalPages,
}: {
    media: UnifiedMedia[];
    query: string;
    totalPages: number;
}) {
    const [allMedia, setAllMedia] = useState(media);
    const [showMdl, setShowMdl] = useState(false);
    const [mdlResults, setMdlResults] = useState<UnifiedMedia[]>([]);
    const [mdlLoading, setMdlLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

    // Refs so the IntersectionObserver callback always has fresh values
    const pageRef = useRef(1);
    const hasMoreRef = useRef(totalPages > 1);
    const loadingMoreRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Set up infinite scroll observer once on mount
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            async ([entry]) => {
                if (!entry.isIntersecting || loadingMoreRef.current || !hasMoreRef.current) return;

                loadingMoreRef.current = true;
                setLoadingMore(true);

                const nextPage = pageRef.current + 1;
                const { media: newMedia, totalPages: tp } = await fetchMoreMedia(query, nextPage);

                setAllMedia((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    return [...prev, ...newMedia.filter((m) => !seen.has(m.id))];
                });

                pageRef.current = nextPage;
                hasMoreRef.current = nextPage < tp;
                loadingMoreRef.current = false;
                setLoadingMore(false);
            },
            { rootMargin: "400px" },
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleMdlToggle() {
        if (!showMdl && mdlResults.length === 0) {
            setMdlLoading(true);
            const results = await fetchMdlSearchResults(query);
            setMdlResults(results);
            setMdlLoading(false);
        }
        setShowMdl((v) => !v);
        setSelectedCountry(null);
    }

    const displayed = showMdl ? [...mdlResults, ...allMedia] : allMedia;

    // Country pills — computed from all accumulated results
    const countryCounts = displayed.reduce<Record<string, number>>((acc, item) => {
        const c = item.originCountry;
        if (c) acc[c] = (acc[c] ?? 0) + 1;
        return acc;
    }, {});
    const availableCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([code, count]) => ({ code, count }));

    const filtered = selectedCountry
        ? displayed.filter((item) => item.originCountry === selectedCountry)
        : displayed;

    const showCountryFilter = availableCountries.length >= 2;

    return (
        <div className="space-y-4">
            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-2">
                {/* MDL toggle */}
                <button
                    onClick={handleMdlToggle}
                    disabled={mdlLoading}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-60 ${
                        showMdl
                            ? "bg-sky-500/20 border-sky-500/40 text-sky-300 hover:bg-sky-500/30"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                    }`}
                >
                    {mdlLoading ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                    {mdlLoading ? "Loading MDL…" : "MDL results"}
                </button>

                {/* Country pills */}
                {showCountryFilter && (
                    <>
                        <div className="w-px h-4 bg-white/10" />
                        <button
                            onClick={() => setSelectedCountry(null)}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                selectedCountry === null
                                    ? "bg-white/15 border-white/25 text-white"
                                    : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                            }`}
                        >
                            All
                        </button>
                        {availableCountries.map(({ code, count }) => (
                            <button
                                key={code}
                                onClick={() => setSelectedCountry(selectedCountry === code ? null : code)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    selectedCountry === code
                                        ? "bg-indigo-500/25 border-indigo-400/40 text-indigo-300"
                                        : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60"
                                }`}
                            >
                                {COUNTRY_LABELS[code] ?? code}
                                <span className="opacity-50">{count}</span>
                            </button>
                        ))}
                    </>
                )}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {filtered.map((item) => (
                    <MediaCard key={item.id} media={item} showSourceBadge />
                ))}
                {filtered.length === 0 && (
                    <p className="col-span-full text-sm text-gray-500">No results for this country.</p>
                )}
            </div>

            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} className="flex justify-center py-4">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-gray-500" />}
            </div>
        </div>
    );
}
