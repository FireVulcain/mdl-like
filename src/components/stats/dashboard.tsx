"use client";

import { motion } from "framer-motion";
import { type DashboardStats } from "@/types/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Counter } from "./counter";
import { Play, Tv, Clock, CheckCircle2, BarChart3, Star, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import Link from "next/link";
import Image from "next/image";

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

interface StatsDashboardProps {
    stats: DashboardStats;
    continueWatching?: Array<{
        id: string;
        title: string;
        poster: string;
        backdrop?: string;
        progress: number;
        totalEp: number;
        externalId: string;
        source: string;
    }>;
}

export function StatsDashboard({ stats, continueWatching = [] }: StatsDashboardProps) {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: { staggerChildren: 0.1 },
        },
    };

    const item = {
        hidden: { y: 20, opacity: 0 },
        show: { y: 0, opacity: 1 },
    };

    const watchTimeHours = Math.floor(stats.watchTimeMinutes / 60);
    const avgRating = stats.ratingDistribution.length > 0
        ? (stats.ratingDistribution.reduce((sum, r) => sum + (r.rating * r.count), 0) / 
           stats.ratingDistribution.reduce((sum, r) => sum + r.count, 0)).toFixed(1)
        : "0.0";

    return (
        <div className="relative">
            {/* Background Effects */}
            <div className="fixed inset-0 -z-10 pointer-events-none">
                <div className="absolute top-20 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px]" />
                <div className="absolute top-60 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px]" />
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
                {/* Compact Stats Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 hover:border-white/20 transition-all shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Total Watched</p>
                                        <p className="text-2xl font-bold text-white">
                                            <Counter value={stats.totalMovies + stats.totalTV} />
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {stats.totalMovies} movies · {stats.totalTV} series
                                        </p>
                                    </div>
                                    <Play className="h-8 w-8 text-blue-400 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 hover:border-white/20 transition-all shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Watch Time</p>
                                        <p className="text-2xl font-bold text-white">
                                            <Counter value={watchTimeHours} suffix="h" />
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            ~ {(stats.watchTimeMinutes / (60 * 24)).toFixed(1)} days
                                        </p>
                                    </div>
                                    <Clock className="h-8 w-8 text-purple-400 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 hover:border-white/20 transition-all shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Avg Rating</p>
                                        <div className="flex items-center gap-2">
                                            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                                            <p className="text-2xl font-bold text-white">{avgRating}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">Out of 10</p>
                                    </div>
                                    <TrendingUp className="h-8 w-8 text-yellow-400 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>

                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 hover:border-white/20 transition-all shadow-lg">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-400 mb-1">Completion</p>
                                        <p className="text-2xl font-bold text-white">
                                            <Counter value={Math.round(stats.completionRate)} suffix="%" />
                                        </p>
                                        <div className="w-full bg-white/5 h-1 rounded-full mt-2 overflow-hidden">
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${stats.completionRate}%` }}
                                                transition={{ duration: 1, delay: 0.5 }}
                                                className="bg-gradient-to-r from-green-500 to-emerald-500 h-full rounded-full"
                                            />
                                        </div>
                                    </div>
                                    <CheckCircle2 className="h-8 w-8 text-green-400 opacity-50" />
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>

                {/* Continue Watching - Large Prominent Section */}
                {continueWatching.length > 0 && (
                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2 text-white">
                                    <Play className="h-5 w-5 text-blue-400" />
                                    Continue Watching
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {continueWatching.slice(0, 6).map((show) => {
                                        const progressPercent = (show.progress / show.totalEp) * 100;
                                        return (
                                            <Link
                                                key={show.id}
                                                href={`/media/${show.source.toLowerCase()}-${show.externalId}`}
                                                className="group"
                                            >
                                                <div className="relative aspect-video rounded-lg overflow-hidden bg-black/20">
                                                    {(show.backdrop || show.poster) && (
                                                        <Image
                                                            src={show.backdrop || show.poster}
                                                            alt={show.title}
                                                            fill
                                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                                                    <div className="absolute bottom-0 left-0 right-0 p-3">
                                                        <p className="text-white font-semibold text-sm mb-2 line-clamp-1">
                                                            {show.title}
                                                        </p>
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between text-xs text-gray-300">
                                                                <span>Episode {show.progress} / {show.totalEp}</span>
                                                                <span>{Math.round(progressPercent)}%</span>
                                                            </div>
                                                            <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
                                                                <div
                                                                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"
                                                                    style={{ width: `${progressPercent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {/* Charts Row - Simplified */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Rating Distribution */}
                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-white">
                                    <BarChart3 className="h-4 w-4 text-blue-400" />
                                    Rating Distribution
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.ratingDistribution}>
                                        <XAxis 
                                            dataKey="rating" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            fontSize={12}
                                            stroke="#888"
                                        />
                                        <Tooltip
                                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                            contentStyle={{
                                                borderRadius: "8px",
                                                border: "1px solid rgba(255,255,255,0.1)",
                                                backgroundColor: "rgba(0,0,0,0.8)",
                                                backdropFilter: "blur(10px)",
                                            }}
                                            itemStyle={{ color: "#ffffff" }}
                                            labelStyle={{ color: "#ffffff" }}
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

                    {/* Top Genres */}
                    <motion.div variants={item}>
                        <Card className="bg-gradient-to-br from-white/[0.05] to-white/[0.01] backdrop-blur-sm border-white/10 shadow-lg">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2 text-white">
                                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                                    Top Genres
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {stats.topGenres.length > 0 ? (
                                        stats.topGenres.map((genre, i) => (
                                            <div key={genre.name} className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-medium text-white">{genre.name}</span>
                                                    <span className="text-gray-400">{genre.count} titles</span>
                                                </div>
                                                <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${genre.percentage}%` }}
                                                        transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
                                                        className="h-full rounded-full"
                                                        style={{ 
                                                            background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}, ${COLORS[(i + 1) % COLORS.length]})`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-gray-500 text-center py-8">
                                            No genre data available yet
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
}
