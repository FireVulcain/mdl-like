'use client';

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Check } from "lucide-react";

interface Season {
  seasonNumber: number;
  episodeCount: number;
  name: string;
}

interface SeasonSelectorProps {
  seasons: Season[];
  selectedSeason: number;
}

export function SeasonSelector({ seasons, selectedSeason }: SeasonSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!seasons || seasons.length <= 1) return null;

  const handleSelect = (seasonNumber: number) => {
    setOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.set("season", seasonNumber.toString());
    startTransition(() => {
      router.push(`?${params.toString()}`);
      router.refresh();
    });
  };

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        className="inline-flex items-center gap-1 text-3xl font-bold text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-60 disabled:cursor-wait"
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <span>S{selectedSeason}</span>
            <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 min-w-[160px] rounded-lg border border-white/12 bg-gray-900/95 shadow-2xl backdrop-blur-sm overflow-hidden">
          {seasons.map((season) => {
            const isSelected = season.seasonNumber === selectedSeason;
            return (
              <button
                key={season.seasonNumber}
                onClick={() => handleSelect(season.seasonNumber)}
                className={`flex items-center justify-between gap-3 w-full px-3 py-2 text-sm text-left whitespace-nowrap transition-colors ${isSelected ? "bg-white/8 text-white" : "text-gray-300 hover:bg-white/6 hover:text-white"}`}
              >
                <span>{season.name}</span>
                {isSelected && <Check className="h-3 w-3 text-sky-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
