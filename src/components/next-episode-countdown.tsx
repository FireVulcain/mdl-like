'use client';

import { useEffect, useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface NextEpisodeData {
    airDate: string;
    episodeNumber: number;
    seasonNumber: number;
    name: string;
    seasonEpisodeCount?: number; // From TVmaze - more accurate than TMDB's totalEpisodes
}

interface SeasonData {
    seasonNumber: number;
    episodeCount: number;
    airDate: string | null;
}

interface NextEpisodeCountdownProps {
    // Direct data from TMDB (preferred)
    nextEpisode?: NextEpisodeData | null;
    // Fallback: season data for prediction
    currentSeason?: SeasonData | null;
    totalEpisodes?: number;
    // Show status to determine if we should predict
    status?: string;
    // Fallback: show's first air date (used if season air date is missing)
    firstAirDate?: string | null;
}

interface TimeLeft {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

interface PredictedEpisode {
    airDate: string;
    episodeNumber: number;
    isPredicted: boolean;
}

// Default broadcast time: 10:00 PM KST (22:00 UTC+9)
const BROADCAST_HOUR_KST = 22;
const BROADCAST_MINUTE_KST = 0;

/**
 * Calculates the predicted air date for a specific episode number.
 * Pattern: 2 episodes per week (consecutive days)
 * Week 1: Ep1 (day 0), Ep2 (day 1)
 * Week 2: Ep3 (day 7), Ep4 (day 8)
 */
function getEpisodeAirDate(seasonAirDate: string, episodeNumber: number): string {
    // Parse the season air date
    const [year, month, day] = seasonAirDate.split('-').map(Number);

    const weekNumber = Math.ceil(episodeNumber / 2);
    const isSecondOfWeek = episodeNumber % 2 === 0;
    const daysFromStart = (weekNumber - 1) * 7 + (isSecondOfWeek ? 1 : 0);

    // Create date and add days (using local date to avoid timezone issues)
    const epDate = new Date(year, month - 1, day + daysFromStart);

    // Format as YYYY-MM-DD
    const epYear = epDate.getFullYear();
    const epMonth = String(epDate.getMonth() + 1).padStart(2, '0');
    const epDay = String(epDate.getDate()).padStart(2, '0');

    return `${epYear}-${epMonth}-${epDay}`;
}

/**
 * Predicts the air date for a specific episode number.
 * Used when we know which episode to predict (e.g., after TMDB episode has aired).
 */
function predictNextEpisodeFromNumber(
    seasonAirDate: string,
    episodeNumber: number,
    totalEpisodes: number,
): PredictedEpisode | null {
    if (episodeNumber > totalEpisodes) {
        return null;
    }

    const airDate = getEpisodeAirDate(seasonAirDate, episodeNumber);
    const airDateTime = getAirDateTime(airDate);
    const now = new Date();

    // If this episode has already aired, try the next one
    if (airDateTime <= now) {
        return predictNextEpisodeFromNumber(seasonAirDate, episodeNumber + 1, totalEpisodes);
    }

    return {
        airDate,
        episodeNumber,
        isPredicted: true,
    };
}

/**
 * Predicts the next episode air date based on 2 episodes per week pattern.
 * Pattern: Episode 1 on Day X, Episode 2 on Day X+1, then next week repeats.
 *
 * Example: If Ep1 airs Dec 22 (Sun), Ep2 airs Dec 23 (Mon), Ep3 airs Dec 29 (Sun), etc.
 */
function predictNextEpisode(
    seasonAirDate: string,
    totalEpisodes: number,
): PredictedEpisode | null {
    const now = new Date();
    const firstEpDate = new Date(seasonAirDate + 'T00:00:00');

    // If the season hasn't started yet, return episode 1
    if (now < firstEpDate) {
        return {
            airDate: seasonAirDate,
            episodeNumber: 1,
            isPredicted: true,
        };
    }

    // Find the next episode that hasn't aired yet
    return predictNextEpisodeFromNumber(seasonAirDate, 1, totalEpisodes);
}

function getAirDateTime(airDate: string): Date {
    // Parse the air date (YYYY-MM-DD format)
    const [year, month, day] = airDate.split('-').map(Number);

    // Create date at broadcast time in KST (UTC+9)
    // We need to convert KST to UTC for accurate countdown
    const utcHour = BROADCAST_HOUR_KST - 9; // Convert to UTC

    // Create UTC date
    const airDateTime = new Date(Date.UTC(year, month - 1, day, utcHour, BROADCAST_MINUTE_KST, 0));

    return airDateTime;
}

function calculateTimeLeft(airDate: string): TimeLeft | null {
    const airDateTime = getAirDateTime(airDate);
    const now = new Date();
    const difference = airDateTime.getTime() - now.getTime();

    if (difference <= 0) {
        return null; // Episode has already aired
    }

    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
        seconds: Math.floor((difference / 1000) % 60),
    };
}

function formatAirDate(airDate: string): string {
    const airDateTime = getAirDateTime(airDate);

    return airDateTime.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }) + ' ' + airDateTime.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="text-2xl md:text-3xl font-bold text-white tabular-nums">
                {value.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] md:text-xs text-gray-400 uppercase tracking-wider">
                {label}
            </div>
        </div>
    );
}

export function NextEpisodeCountdown({
    nextEpisode,
    currentSeason,
    totalEpisodes,
    status,
    firstAirDate,
}: NextEpisodeCountdownProps) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [mounted, setMounted] = useState(false);

    // Determine episode data: use TMDB data or predict
    const episodeData = useMemo(() => {
        const isOngoing = status === 'Returning Series' || status === 'In Production';
        const airDateForPrediction = currentSeason?.airDate || firstAirDate;

        // Check if TMDB data is available AND hasn't aired yet
        if (nextEpisode) {
            const tmdbAirDateTime = getAirDateTime(nextEpisode.airDate);
            const now = new Date();

            // If TMDB episode hasn't aired yet, use it
            if (tmdbAirDateTime > now) {
                return {
                    airDate: nextEpisode.airDate,
                    episodeNumber: nextEpisode.episodeNumber,
                    isPredicted: false,
                };
            }

            // TMDB episode already aired - fall back to prediction for the NEXT episode
            if (isOngoing && airDateForPrediction && totalEpisodes) {
                // Predict starting from the episode AFTER the one that just aired
                const nextEpNumber = nextEpisode.episodeNumber + 1;
                if (nextEpNumber <= totalEpisodes) {
                    return predictNextEpisodeFromNumber(airDateForPrediction, nextEpNumber, totalEpisodes);
                }
            }

            return null;
        }

        // No TMDB data - use prediction if show is ongoing
        if (isOngoing && airDateForPrediction && totalEpisodes) {
            return predictNextEpisode(airDateForPrediction, totalEpisodes);
        }

        return null;
    }, [nextEpisode, currentSeason, totalEpisodes, status, firstAirDate]);

    useEffect(() => {
        setMounted(true);

        if (!episodeData) return;

        // Calculate initial time
        setTimeLeft(calculateTimeLeft(episodeData.airDate));

        // Update every second
        const timer = setInterval(() => {
            const newTimeLeft = calculateTimeLeft(episodeData.airDate);
            setTimeLeft(newTimeLeft);

            // Clear interval if countdown is done
            if (!newTimeLeft) {
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [episodeData]);

    // Don't render on server, if no episode data, or if episode has already aired
    if (!mounted || !episodeData || !timeLeft) {
        return null;
    }

    // Prefer seasonEpisodeCount from TVmaze (more accurate for shows with different season structures)
    const effectiveTotalEpisodes = nextEpisode?.seasonEpisodeCount || totalEpisodes;
    const episodeText = effectiveTotalEpisodes
        ? `Episode ${episodeData.episodeNumber} of ${effectiveTotalEpisodes}`
        : `Episode ${episodeData.episodeNumber}`;

    return (
        <div
            className="relative overflow-hidden rounded-xl border border-white/10 p-5 shadow-lg"
            style={{
                background: 'rgba(17, 24, 39, 0.6)',
                backdropFilter: 'blur(20px)',
                boxShadow:
                    '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
            }}
        >
            {/* Top highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex flex-col gap-4">
                {/* Header with Calendar Icon and Episode Info */}
                <div className="flex items-center gap-3">
                    <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20 text-primary">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-white">
                            {episodeText} {episodeData.isPredicted ? 'estimated on' : 'airing on'}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {formatAirDate(episodeData.airDate)}
                            {episodeData.isPredicted && (
                                <span className="ml-1 text-yellow-500/70">*</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center justify-between px-2">
                    <CountdownUnit value={timeLeft.days} label="days" />
                    <div className="text-lg text-gray-500 font-light">:</div>
                    <CountdownUnit value={timeLeft.hours} label="hours" />
                    <div className="text-lg text-gray-500 font-light">:</div>
                    <CountdownUnit value={timeLeft.minutes} label="mins" />
                    <div className="text-lg text-gray-500 font-light">:</div>
                    <CountdownUnit value={timeLeft.seconds} label="sec" />
                </div>

                {/* Prediction disclaimer */}
                {episodeData.isPredicted && (
                    <div className="text-[10px] text-gray-500 text-center -mt-2">
                        * Estimated based on 2 episodes/week schedule
                    </div>
                )}
            </div>
        </div>
    );
}
