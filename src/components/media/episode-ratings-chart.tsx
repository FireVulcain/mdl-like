"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export interface EpisodeChartPoint {
    ep: number;
    label: string;
    rating: number;
    title: string;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: EpisodeChartPoint }[] }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-sm shadow-xl">
            <p className="text-gray-400 text-[11px] mb-0.5">Episode {d.ep}</p>
            <p className="text-white font-medium truncate max-w-44">{d.title}</p>
            <p className="text-yellow-400 font-semibold mt-0.5">{d.rating.toFixed(1)}</p>
        </div>
    );
}

export function EpisodeRatingsChart({ data }: { data: EpisodeChartPoint[] }) {
    const ratings = data.map((d) => d.rating);
    const minRating = Math.min(...ratings);
    const maxRating = Math.max(...ratings);
    const yMin = Math.max(0, parseFloat((minRating - 0.5).toFixed(1)));
    const yMax = Math.min(10, parseFloat((maxRating + 0.5).toFixed(1)));

    return (
        <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                    <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                    dataKey="label"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                />
                <YAxis
                    domain={[yMin, yMax]}
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickCount={4}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }} />
                <Area
                    type="monotone"
                    dataKey="rating"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#ratingGrad)"
                    dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
