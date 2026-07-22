export type DashboardStats = {
    totalMovies: number;
    totalTV: number;
    totalEpisodes: number;
    watchTimeMinutes: number;
    completionRate: number;
    currentStreak: number;
    genreBreakdown: { name: string; value: number }[];
    ratingDistribution: { rating: number; count: number }[];
    monthlyActivity: { month: string; count: number }[];
    // ISO timestamps of real (non-backfill) actions over the past year. Bucketing into
    // days happens client-side so it follows the viewer's calendar, not the server's UTC.
    activityTimestamps: string[];
    topGenres: { name: string; count: number; percentage: number }[];
    topThemes: { name: string; count: number }[];
    decadeDistribution: { decade: string; count: number }[];
    countryBreakdown: { country: string; count: number }[];
    yearBreakdown: { year: number; count: number }[];
    topActors: { name: string; profileImage: string; slug: string; count: number }[];
};

export const EMPTY_STATS: DashboardStats = {
    totalMovies: 0,
    totalTV: 0,
    totalEpisodes: 0,
    watchTimeMinutes: 0,
    completionRate: 0,
    currentStreak: 0,
    genreBreakdown: [],
    ratingDistribution: [],
    monthlyActivity: [],
    activityTimestamps: [],
    topGenres: [],
    topThemes: [],
    decadeDistribution: [],
    countryBreakdown: [],
    yearBreakdown: [],
    topActors: [],
};
