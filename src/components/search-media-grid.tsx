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
            {/* Controls row.

                Same filter chrome as /history: a flat fill, no border, and a
                ring only on the one that is on. Every pill used to carry its own
                border and fill in both states, so the frame marked nothing — it
                was just a box around each word. The ring now does the work the
                border was pretending to do.

                Colour follows meaning, as everywhere else: sky is MDL. The
                country pills had picked up indigo, which means nothing here and
                nothing anywhere else in the app, so they take the neutral
                selected treatment "All" already used. */}
            <div className="flex flex-wrap items-center gap-2">
                {/* MDL toggle */}
                <button
                    onClick={handleMdlToggle}
                    disabled={mdlLoading}
                    className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
                        showMdl
                            ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/30"
                            : "bg-white/5 text-gray-500 hover:bg-white/8 hover:text-white"
                    }`}
                >
                    {mdlLoading ? <Loader2 className="size-3 animate-spin" /> : <span className="size-1.5 rounded-full bg-current" />}
                    {mdlLoading ? "Loading MDL…" : "MDL results"}
                </button>

                {/* Country pills */}
                {showCountryFilter && (
                    <>
                        <div className="w-px h-4 bg-white/8" />
                        <button
                            onClick={() => setSelectedCountry(null)}
                            className={`h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                selectedCountry === null
                                    ? "bg-white/10 text-white ring-1 ring-white/15"
                                    : "bg-white/5 text-gray-500 hover:bg-white/8 hover:text-white"
                            }`}
                        >
                            All
                        </button>
                        {availableCountries.map(({ code, count }) => (
                            <button
                                key={code}
                                onClick={() => setSelectedCountry(selectedCountry === code ? null : code)}
                                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                    selectedCountry === code
                                        ? "bg-white/10 text-white ring-1 ring-white/15"
                                        : "bg-white/5 text-gray-500 hover:bg-white/8 hover:text-white"
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
