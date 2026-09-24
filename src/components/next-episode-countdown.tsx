'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { getAirDateTime, resolveAirMoment } from '@/lib/air-moment';
import { hasFinishedAiring } from '@/lib/format-aired';

interface NextEpisodeData {
    airDate: string;
    airDateTime?: string | null; // exact ISO instant (MDL-sourced); date-only sources assume 22:00 KST
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
    /**
     * MDL's broadcast range, e.g. "Aug  2, 2026 - Aug 13, 2026".
     *
     * TMDB's status is the wrong thing to gate a prediction on by itself: it
     * left Genius Girlfriend on "Returning Series" the day after its final
     * episode, and the predictor happily invented an episode 5 for a show that
     * had aired all 28. MDL states the end date, and states it on time.
     */
    airedRange?: string | null;
    /**
     * ISO country. Only KR is predicted from.
     *
     * Two episodes a week is a Korean broadcast convention — a pair of nights,
     * the same two every week — which is why a date can be inferred from the
     * premiere alone. Chinese platforms release one to two a day, and the count
     * changes with the day, so the same arithmetic invents a schedule rather
     * than reading one. Nothing outside KR is guessed at.
     */
    originCountry?: string | null;
    // Fallback: show's first air date (used if season air date is missing)
    firstAirDate?: string | null;
    /**
     * The calendar, already narrowed to this show.
     *
     * Sits inside this card rather than beside it on the page so it inherits
     * the card's gate: no countdown means nothing left to air, and a link to a
     * schedule that has run out is a link to an empty grid. Undefined for a
     * show that is not on the list, which is the other way the calendar can
     * have nothing to say about it.
     */
    calendarHref?: string;
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


// Takes `now` rather than reading the clock, so the countdown can be derived
// during render from a single piece of ticking state instead of being pushed
// into state of its own.
function calculateTimeLeft(airDate: string, airDateTime: string | null | undefined, now: Date): TimeLeft | null {
    const airMoment = resolveAirMoment(airDate, airDateTime);
    const difference = airMoment.getTime() - now.getTime();

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

function formatAirDate(airDate: string, airDateTime?: string | null): string {
    const airMoment = resolveAirMoment(airDate, airDateTime);

    return airMoment.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    }) + ' · ' + airMoment.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
}

// A clock on one line — days, then hh:mm:ss — rather than four ticking blocks.
// Tabular figures keep its width still as the seconds turn.
function formatTimeLeft({ days, hours, minutes, seconds }: TimeLeft): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    return days > 0 ? `${days}d ${clock}` : clock;
}

export function NextEpisodeCountdown({
    nextEpisode,
    currentSeason,
    totalEpisodes,
    status,
    firstAirDate,
    airedRange,
    originCountry,
    calendarHref,
}: NextEpisodeCountdownProps) {
    /**
     * The clock, and the only state here.
     *
     * Null until the first tick, which is also what keeps the server and the
     * first client render agreeing: neither has a time yet, so both draw
     * nothing and there is no mismatch to hydrate around. The separate `mounted`
     * flag this used to carry was doing the same job a second time.
     */
    const [now, setNow] = useState<Date | null>(null);

    // Determine episode data: use TMDB data or predict
    const episodeData = useMemo(() => {
        // Everything here gates guesses only. A real dated episode from TMDB or
        // MDL is still trusted below: a source naming an episode outranks any of
        // this.
        //
        // Three ways a prediction can be wrong, and each is checked:
        // the cadence only holds in Korea; MDL dates the end of a run and TMDB
        // often does not notice for days; and TMDB's own status has to agree.
        const isOngoing =
            originCountry === 'KR' &&
            !hasFinishedAiring(airedRange) &&
            (status === 'Returning Series' || status === 'In Production');
        const airDateForPrediction = currentSeason?.airDate || firstAirDate;

        // Check if source data is available AND hasn't aired yet
        if (nextEpisode) {
            const airMoment = resolveAirMoment(nextEpisode.airDate, nextEpisode.airDateTime);
            const now = new Date();

            // If the episode hasn't aired yet, use it
            if (airMoment > now) {
                return {
                    airDate: nextEpisode.airDate,
                    airDateTime: nextEpisode.airDateTime ?? null,
                    episodeNumber: nextEpisode.episodeNumber,
                    isPredicted: false,
                };
            }

            // Episode already aired - fall back to prediction for the NEXT episode
            if (isOngoing && airDateForPrediction && totalEpisodes) {
                // Predict starting from the episode AFTER the one that just aired
                const nextEpNumber = nextEpisode.episodeNumber + 1;
                if (nextEpNumber <= totalEpisodes) {
                    const predicted = predictNextEpisodeFromNumber(airDateForPrediction, nextEpNumber, totalEpisodes);
                    return predicted ? { ...predicted, airDateTime: null } : null;
                }
            }

            return null;
        }

        // No source data - use prediction if show is ongoing
        if (isOngoing && airDateForPrediction && totalEpisodes) {
            const predicted = predictNextEpisode(airDateForPrediction, totalEpisodes);
            return predicted ? { ...predicted, airDateTime: null } : null;
        }

        return null;
    }, [nextEpisode, currentSeason, totalEpisodes, status, firstAirDate, airedRange, originCountry]);

    useEffect(() => {
        if (!episodeData) return;

        // Both writes happen in callbacks, never in the effect body: setting
        // state synchronously there is what react-hooks/purity objects to, and
        // an effect that subscribes to a ticking source is exactly the shape it
        // asks for. The zero-delay timer is the first tick, so the countdown
        // does not sit blank for a second waiting on the interval.
        const first = setTimeout(() => setNow(new Date()), 0);
        const timer = setInterval(() => setNow(new Date()), 1000);

        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };
    }, [episodeData]);

    // Derived, not stored. The interval only moves the clock forward; what that
    // means for the display is worked out here, and the countdown stops on its
    // own once the moment passes.
    const timeLeft = now && episodeData ? calculateTimeLeft(episodeData.airDate, episodeData.airDateTime, now) : null;

    // Nothing before the first tick, nothing without an episode, nothing once it
    // has aired — all three read as "no countdown to show".
    if (!episodeData || !timeLeft) {
        return null;
    }

    // Prefer seasonEpisodeCount from TVmaze (more accurate for shows with different season structures)
    const effectiveTotalEpisodes = nextEpisode?.seasonEpisodeCount || totalEpisodes;
    const episodeText = effectiveTotalEpisodes
        ? `Episode ${episodeData.episodeNumber} of ${effectiveTotalEpisodes}`
        : `Episode ${episodeData.episodeNumber}`;

    const body = (
        <>
            <span className="flex min-w-0 flex-col">
                <span className="text-[13px] font-medium text-fg">{episodeText}</span>
                <span
                    className="truncate text-xs text-fg-dim"
                    title={episodeData.isPredicted ? 'Estimated from the usual two-episodes-a-week Korean schedule' : undefined}
                >
                    {formatAirDate(episodeData.airDate, episodeData.airDateTime)}
                    {episodeData.isPredicted && ', estimated'}
                </span>
            </span>
            <span className="whitespace-nowrap text-lg font-semibold text-watching tabular-nums">{formatTimeLeft(timeLeft)}</span>
        </>
    );

    // The foot of the sidebar's info box, not a card of its own: the next
    // airing is a fact about the broadcast, beside Aired and Network. The
    // negative margins cancel the box's padding so the rule runs edge to edge.
    const footClass = '-mx-4 -mb-4 flex items-center justify-between gap-3 rounded-b-lg border-t border-line-soft bg-surface-1 px-4 py-3';

    return calendarHref ? (
        <Link href={calendarHref} title="See the full schedule" className={`${footClass} transition-colors hover:bg-surface-2`}>
            {body}
        </Link>
    ) : (
        <div className={footClass}>{body}</div>
    );
}
