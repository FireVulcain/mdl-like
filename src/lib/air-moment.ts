// Turning an episode's air date into an instant, and that instant into the
// wording shown next to it.
//
// Shared because the same episode is announced in several places — the
// watchlist badge, the media-page countdown, the home airing rows — and each
// used to carry its own copy. They counted from different origins (midnight vs
// broadcast time), so the same show could read "Tomorrow" in one place and
// "in 1d" in another.

// Default broadcast time: 10:00 PM KST (22:00 UTC+9)
const BROADCAST_HOUR_KST = 22;

/** 22:00 KST on `airDate` (YYYY-MM-DD), as an absolute instant. */
export function getAirDateTime(airDate: string): Date {
    const [year, month, day] = airDate.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, BROADCAST_HOUR_KST - 9, 0, 0));
}

/** Exact instant when the source knows it (MDL), 22:00 KST assumption otherwise. */
export function resolveAirMoment(airDate: string, airDateTime?: string | null): Date {
    if (airDateTime) {
        const exact = new Date(airDateTime);
        if (!Number.isNaN(exact.getTime())) return exact;
    }
    return getAirDateTime(airDate);
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * "Today" / "Tomorrow" / "in 3d" — the watchlist badge's wording, at day
 * granularity (the hours it also shows would be stale here: this is rendered on
 * the server and never ticks).
 *
 * Days are floored from the air moment, exactly as the badge floors them, so a
 * show reading "in 3d 17h" on the watchlist reads "in 3d" here and not "in 4d".
 */
export function formatAirDayRelative(airDate: string, airDateTime?: string | null, now: Date = new Date()): string {
    const airMoment = resolveAirMoment(airDate, airDateTime);

    if (isSameDay(airMoment, now)) return "Today";

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (isSameDay(airMoment, tomorrow)) return "Tomorrow";

    const days = Math.floor((airMoment.getTime() - now.getTime()) / 86_400_000);
    // Already broadcast, but the day rolled over somewhere else in the world
    if (days < 0) return "Today";
    return `in ${days}d`;
}
