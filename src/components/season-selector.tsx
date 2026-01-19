'use client';

import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

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

  if (!seasons || seasons.length <= 1) return null; // Don't show if only 1 season (or 0)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    // Update URL param
    const params = new URLSearchParams(window.location.search);
    params.set('season', val);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="relative">
      <select
        value={selectedSeason.toString()}
        onChange={handleChange}
        className="h-10 pl-4 pr-9 rounded-xl bg-white/10 border border-white/10 text-white text-sm font-medium hover:bg-white/15 hover:border-white/20 focus:border-blue-500 focus:outline-none transition-all cursor-pointer appearance-none"
      >
        {seasons.map((season) => (
          <option key={season.seasonNumber} value={season.seasonNumber.toString()} className="bg-gray-900">
            {season.name} ({season.episodeCount} eps)
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
    </div>
  );
}
