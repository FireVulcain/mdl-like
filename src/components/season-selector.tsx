'use client';

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";

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

  if (!seasons || seasons.length <= 1) return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const params = new URLSearchParams(window.location.search);
    params.set('season', val);
    startTransition(() => {
      router.push(`?${params.toString()}`);
    });
  };

  return (
    <div className="relative">
      <select
        value={selectedSeason.toString()}
        onChange={handleChange}
        disabled={isPending}
        className="h-10 pl-4 pr-9 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 hover:border-white/20 focus:border-blue-500 focus:outline-none transition-all cursor-pointer appearance-none disabled:opacity-60 disabled:cursor-wait"
      >
        {seasons.map((season) => (
          <option key={season.seasonNumber} value={season.seasonNumber.toString()} className="bg-gray-900">
            {season.name} ({season.episodeCount} eps)
          </option>
        ))}
      </select>
      {isPending ? (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-400 animate-spin pointer-events-none" />
      ) : (
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      )}
    </div>
  );
}
