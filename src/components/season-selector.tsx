'use client';

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const handleValueChange = (val: string) => {
    // Update URL param
    const params = new URLSearchParams(window.location.search);
    params.set('season', val);
    router.push(`?${params.toString()}`);
  };

  return (
    <Select
      value={selectedSeason.toString()}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select Season" />
      </SelectTrigger>
      <SelectContent>
        {seasons.map((season) => (
          <SelectItem key={season.seasonNumber} value={season.seasonNumber.toString()}>
            {season.name} ({season.episodeCount} eps)
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
