"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface NextEpisodeData {
    airDate: string;
    airDateTime?: string | null; // exact ISO instant (MDL-sourced); date-only sources assume 22:00 KST
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
    const [year, month, day] = airDate.split("-").map(Number);
    const utcHour = BROADCAST_HOUR_KST - 9;
    return new Date(Date.UTC(year, month - 1, day, utcHour, 0, 0));
}

// Exact instant when the source knows it (MDL), 22:00 KST assumption otherwise
function resolveAirMoment(airDate: string, airDateTime?: string | null): Date {
    if (airDateTime) {
        const exact = new Date(airDateTime);
        if (!Number.isNaN(exact.getTime())) return exact;
    }
    return getAirDateTime(airDate);
}

function getEpisodeAirDate(seasonAirDate: string, episodeNumber: number): string {
    const [year, month, day] = seasonAirDate.split("-").map(Number);
    const weekNumber = Math.ceil(episodeNumber / 2);
    const isSecondOfWeek = episodeNumber % 2 === 0;
    const daysFromStart = (weekNumber - 1) * 7 + (isSecondOfWeek ? 1 : 0);
    const epDate = new Date(year, month - 1, day + daysFromStart);
    const epYear = epDate.getFullYear();
    const epMonth = String(epDate.getMonth() + 1).padStart(2, "0");
    const epDay = String(epDate.getDate()).padStart(2, "0");
    return `${epYear}-${epMonth}-${epDay}`;
}

function predictNextEpisode(
    seasonAirDate: string,
    totalEpisodes: number,
    startFromEpisode: number = 1,
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

function calculateTimeLeft(airDate: string, airDateTime?: string | null): TimeLeft | null {
    const airMoment = resolveAirMoment(airDate, airDateTime);
    const now = new Date();
    const difference = airMoment.getTime() - now.getTime();

    if (difference <= 0) {
        // Episode air time passed but date is still today — show "Today"
        if (isToday(airDate, airDateTime)) return { days: 0, hours: 0, minutes: 0 };
        return null;
    }

    return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / (1000 * 60)) % 60),
    };
}

function isToday(airDate: string, airDateTime?: string | null): boolean {
    const airMoment = resolveAirMoment(airDate, airDateTime);
    const now = new Date();
    return airMoment.getFullYear() === now.getFullYear() && airMoment.getMonth() === now.getMonth() && airMoment.getDate() === now.getDate();
}

function isTomorrow(airDate: string, airDateTime?: string | null): boolean {
    const airMoment = resolveAirMoment(airDate, airDateTime);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return (
        airMoment.getFullYear() === tomorrow.getFullYear() &&
        airMoment.getMonth() === tomorrow.getMonth() &&
        airMoment.getDate() === tomorrow.getDate()
    );
}

function formatTimeLeft(time: TimeLeft, airDate: string, airDateTime?: string | null): { text: string; useIn: boolean } {
    if (isToday(airDate, airDateTime)) {
        return { text: "Today", useIn: false };
    }
    if (isTomorrow(airDate, airDateTime)) {
        return { text: "Tomorrow", useIn: false };
    }
    if (time.days > 0) {
        return { text: `${time.days}d ${time.hours}h`, useIn: true };
    }
    if (time.hours > 0) {
        return { text: `${time.hours}h ${time.minutes}m`, useIn: true };
    }
    return { text: `${time.minutes}m`, useIn: true };
}

export function NextEpisodeIndicator({ nextEpisode, totalEpisodes, status, seasonAirDate }: NextEpisodeIndicatorProps) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
    const [mounted, setMounted] = useState(false);

    const episodeData = useMemo(() => {
        const isOngoing = status === "Returning Series" || status === "In Production";

        // Check if source data is available and hasn't aired yet (or airs today)
        if (nextEpisode) {
            const airMoment = resolveAirMoment(nextEpisode.airDate, nextEpisode.airDateTime);
            const now = new Date();

            if (airMoment > now || isToday(nextEpisode.airDate, nextEpisode.airDateTime)) {
                return {
                    airDate: nextEpisode.airDate,
                    airDateTime: nextEpisode.airDateTime ?? null,
                    episodeNumber: nextEpisode.episodeNumber,
                    isPredicted: false,
                };
            }

            // Source episode already aired - fall back to prediction
            if (isOngoing && seasonAirDate && totalEpisodes) {
                const nextEpNumber = nextEpisode.episodeNumber + 1;
                if (nextEpNumber <= totalEpisodes) {
                    const predicted = predictNextEpisode(seasonAirDate, totalEpisodes, nextEpNumber);
                    return predicted ? { ...predicted, airDateTime: null } : null;
                }
            }
            return null;
        }

        // No source data - use prediction if show is ongoing
        if (isOngoing && seasonAirDate && totalEpisodes) {
            const predicted = predictNextEpisode(seasonAirDate, totalEpisodes);
            return predicted ? { ...predicted, airDateTime: null } : null;
        }

        return null;
    }, [nextEpisode, totalEpisodes, status, seasonAirDate]);

    useEffect(() => {
        setMounted(true);
        if (!episodeData) return;

        setTimeLeft(calculateTimeLeft(episodeData.airDate, episodeData.airDateTime));

        const timer = setInterval(() => {
            const newTimeLeft = calculateTimeLeft(episodeData.airDate, episodeData.airDateTime);
            setTimeLeft(newTimeLeft);
            if (!newTimeLeft) clearInterval(timer);
        }, 60000); // Update every minute for the compact view

        return () => clearInterval(timer);
    }, [episodeData]);

    if (!mounted || !episodeData || !timeLeft) return null;

    const formatted = formatTimeLeft(timeLeft, episodeData.airDate, episodeData.airDateTime);
    const isAiring = episodeData.episodeNumber > 1 || isToday(episodeData.airDate, episodeData.airDateTime);

    const scheduleHref = `/calendar?date=${episodeData.airDate}`;

    return (
        <Link
            href={scheduleHref}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs text-gray-300 bg-white/10 border border-white/10 px-2 py-0.5 rounded hover:bg-white/20 hover:border-white/20 transition-colors"
        >
            {isAiring && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animation-duration-[2s]" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
            )}
            <span className="text-white font-medium tabular-nums">
                Ep {episodeData.episodeNumber} {formatted.useIn ? "in " : ""}
                {formatted.text}
            </span>
        </Link>
    );
}
