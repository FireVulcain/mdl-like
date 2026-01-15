"use client";

import { motion } from "framer-motion";
import { type DashboardStats } from "@/types/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Counter } from "./counter";
import { Play, Tv, Clock, Zap, CheckCircle2, BarChart3, Calendar, PieChart as PieChartIcon } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

export function StatsDashboard({ stats }: { stats: DashboardStats }) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 },
    };

    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const watchTimeDays = (stats.watchTimeMinutes / (60 * 24)).toFixed(1);

    return (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-8">
            {/* Hero Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <motion.div variants={item}>
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 backdrop-blur-md overflow-hidden relative group hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Total Watched</CardTitle>
                            <Play className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <Counter value={stats.totalMovies + stats.totalTV} />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 flex gap-2">
                                <span className="flex items-center gap-1">
                                    <Play className="h-3 w-3" /> {stats.totalMovies} Movies
                                </span>
                                <span className="flex items-center gap-1">
                                    <Tv className="h-3 w-3" /> {stats.totalTV} Shows
                                </span>
                            </p>
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Play className="h-24 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 backdrop-blur-md overflow-hidden relative group hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Watch Time</CardTitle>
                            <Clock className="h-4 w-4 text-purple-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <Counter value={watchTimeHours} suffix="h" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">≈ {watchTimeDays} days of content</p>
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Clock className="h-24 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20 backdrop-blur-md overflow-hidden relative group hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
                            <Zap className="h-4 w-4 text-orange-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <Counter value={stats.currentStreak} suffix=" days" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Keep going! 🔥</p>
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Zap className="h-24 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={item}>
                    <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 backdrop-blur-md overflow-hidden relative group hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                <Counter value={Math.round(stats.completionRate)} suffix="%" />
                            </div>
                            <div className="w-full bg-emerald-500/10 h-1.5 rounded-full mt-2 overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${stats.completionRate}%` }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className="bg-emerald-500 h-full rounded-full"
                                />
                            </div>
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <CheckCircle2 className="h-24 w-24" />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Rating Distribution */}
                <motion.div variants={item}>
                    <Card className="h-full border-muted/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-blue-500" />
                                Rating Distribution
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px] pt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.ratingDistribution}>
                                    <XAxis dataKey="rating" axisLine={false} tickLine={false} fontSize={12} />
                                    <Tooltip
                                        cursor={{ fill: "var(--muted)", opacity: 0.1 }}
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "1px solid #ffffff20",
                                            backgroundColor: "#111111",
                                            backdropFilter: "blur(10px)",
                                        }}
                                        itemStyle={{ color: "#ffffff" }}
                                        labelStyle={{ color: "#ffffff", marginBottom: "4px" }}
                                    />
                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                        {stats.ratingDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Genre Breakdown */}
                <motion.div variants={item}>
                    <Card className="h-full border-muted/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <PieChartIcon className="h-4 w-4 text-purple-500" />
                                Genre Breakdown
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px] pt-4 flex items-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.genreBreakdown}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                    >
                                        {stats.genreBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "1px solid #ffffff20",
                                            backgroundColor: "#111111",
                                            backdropFilter: "blur(10px)",
                                        }}
                                        itemStyle={{ color: "#ffffff" }}
                                        labelStyle={{ color: "#ffffff", marginBottom: "4px" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="space-y-1 w-1/3">
                                {stats.genreBreakdown.slice(0, 4).map((g, i) => (
                                    <div key={g.name} className="flex items-center gap-2 text-xs truncate">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                        <span className="font-medium truncate">{g.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                {/* Top Genres List */}
                <motion.div variants={item}>
                    <Card className="h-full border-muted/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-emerald-500" />
                                Most Watched Genres
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-2">
                            <div className="space-y-4">
                                {stats.topGenres.length > 0 ? (
                                    stats.topGenres.map((genre, i) => (
                                        <div key={genre.name} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium">{genre.name}</span>
                                                <span className="text-muted-foreground">{genre.count} items</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${genre.percentage}%` }}
                                                    transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                                                    className="h-full rounded-full"
                                                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center py-8">No genre data available yet.</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </motion.div>
    );
}
