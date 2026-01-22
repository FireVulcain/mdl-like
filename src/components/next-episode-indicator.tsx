'use client';

import { useEffect, useState, useMemo } from 'react';
import { Clock } from 'lucide-react';

interface NextEpisodeData {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name?: string;
}

interface NextEpisodeIndicatorProps {
    nextEpisode?: NextEpisodeData | null;
    totalEpisodes?: number | null;
    status?: string | null;
    seasonAirDate?: string | null;
}

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
}

// Default broadcast time: 10:00 PM KST (22:00 UTC+9)
const BROADCAST_HOUR_KST = 22;

function getAirDateTime(airDate: string): Date {
    const [year, month, day] = airDate.split('-').map(Number);
    const utcHour = BROADCAST_HOUR_KST - 9;
    return new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0));
}

function getEpisodeAirDate(seasonAirDate: string, episodeNumber: number): string {
    const [year, month, day] = seasonAirDate.split('-').map(Number);
    const weekNumber = Math.ceil(episodeNumber / 2);
    const isSecondOfWeek = episodeNumber % 2 === 0;
    const daysFromStart = (weekNumber - 1) * 7 + (isSecondOfWeek ? 1 : 0);
    const epDate = new Date(year, month - 1, day + daysFromStart);
    const epYear = epDate.getFullYear();
    const epMonth = String(epDate.getMonth() + 1).padStart(2, '0');
    const epDay = String(epDate.getDate()).padStart(2, '0');
    return `${epYear}-${epMonth}-${epDay}`;
}

function predictNextEpisode(
    seasonAirDate: string,
    totalEpisodes: number,
    startFromEpisode: number = 1
): { airDate: string; episodeNumber: number; isPredicted: boolean } | null {
    const now = new Date();

    for (let ep = startFromEpisode; ep <= totalEpisodes; ep++) {
        const airDate = getEpisodeAirDate(seasonAirDate, ep);
        const airDateTime = getAirDateTime(airDate);
        if (airDateTime > now) {
            return { airDate, episodeNumber: ep, isPredicted: true };
        }
    }
    return null;
}

function calculateTimeLeft(airDate: string): TimeLeft | null {
    const airDateTime = getAirDateTime(airDate);
    const now = new Date();
    const difference = airDateTime.getTime() - now.getTime();

    if (difference <= 0) return null;

    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
    };
}

function formatTimeLeft(time: TimeLeft): string {
    if (time.days > 0) {
        return `${time.days}d ${time.hours}h`;
    }
    if (time.hours > 0) {
        return `${time.hours}h ${time.minutes}m`;
    }
    return `${time.minutes}m`;
}

export function NextEpisodeIndicator({
    nextEpisode,
    totalEpisodes,
    status,
    seasonAirDate,
}: NextEpisodeIndicatorProps) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [mounted, setMounted] = useState(false);

    const episodeData = useMemo(() => {
        const isOngoing = status === 'Returning Series' || status === 'In Production';

        // Check if TMDB data is available and hasn't aired yet
        if (nextEpisode) {
            const tmdbAirDateTime = getAirDateTime(nextEpisode.airDate);
            const now = new Date();

            if (tmdbAirDateTime > now) {
                return {
                    airDate: nextEpisode.airDate,
                    episodeNumber: nextEpisode.episodeNumber,
                    isPredicted: false,
                };
            }

            // TMDB episode already aired - fall back to prediction
            if (isOngoing && seasonAirDate && totalEpisodes) {
                const nextEpNumber = nextEpisode.episodeNumber + 1;
                if (nextEpNumber <= totalEpisodes) {
                    return predictNextEpisode(seasonAirDate, totalEpisodes, nextEpNumber);
                }
            }
            return null;
        }

        // No TMDB data - use prediction if show is ongoing
        if (isOngoing && seasonAirDate && totalEpisodes) {
            return predictNextEpisode(seasonAirDate, totalEpisodes);
        }

        return null;
    }, [nextEpisode, totalEpisodes, status, seasonAirDate]);

    useEffect(() => {
        setMounted(true);
        if (!episodeData) return;

        setTimeLeft(calculateTimeLeft(episodeData.airDate));

        const timer = setInterval(() => {
            const newTimeLeft = calculateTimeLeft(episodeData.airDate);
            setTimeLeft(newTimeLeft);
            if (!newTimeLeft) clearInterval(timer);
        }, 60000); // Update every minute for the compact view

        return () => clearInterval(timer);
    }, [episodeData]);

    if (!mounted || !episodeData || !timeLeft) return null;

    return (
        <div className="flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-md">
            <Clock className="h-3 w-3" />
            <span className="font-medium">
                Ep {episodeData.episodeNumber}
            </span>
            <span className="text-amber-400/70">in</span>
            <span className="font-semibold tabular-nums">
                {formatTimeLeft(timeLeft)}
            </span>
        </div>
    );
}
