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
    activityHeatmap: { date: string; count: number }[];
    topGenres: { name: string; count: number; percentage: number }[];
    decadeDistribution: { decade: string; count: number }[];
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
    activityHeatmap: [],
    topGenres: [],
    decadeDistribution: [],
};
