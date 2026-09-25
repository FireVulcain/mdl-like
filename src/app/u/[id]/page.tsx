import { notFound } from "next/navigation";
import { getPublicUser, getPublicActivity, getPublicStats } from "@/actions/public-profile";
import { getProfileVisibility } from "@/actions/preferences";
import { getPublicWatchlist } from "@/actions/media";
import { getPublicPodiums } from "@/actions/podium";
import { WatchlistTable } from "@/components/watchlist-table";
import { PublicActivityFeed } from "@/components/public-activity-feed";
import { PodiumSection } from "@/components/podium-section";
import { Star } from "lucide-react";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const user = await getPublicUser((await params).id).catch(() => null);
    if (!user?.name) return { title: "Profile" };
    return { title: `${user.name}'s profile`, description: `${user.name}'s drama list on trackr.` };
}

export const dynamic = "force-dynamic";

function formatWatchTime(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    if (h < 24) return `${h}h`;
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
}

export default async function PublicProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [user, watchlist, activity, stats, podiums, session, visibility] = await Promise.all([
        getPublicUser(id),
        getPublicWatchlist(id),
        getPublicActivity(id, 20),
        getPublicStats(id),
        getPublicPodiums(id),
        auth(),
        getProfileVisibility(id),
    ]);

    if (!user) notFound();

    const currentUserId = process.env.SKIP_AUTH === "true"
        ? (process.env.DEV_USER_ID ?? "mock-user-1")
        : (session?.user?.id ?? null);
    const isOwner = currentUserId === id;

    // The owner can always preview their profile, even when it's disabled
    if (!visibility.publicProfileEnabled && !isOwner) notFound();

    // Hide personal scores from visitors when the owner opted out
    const hideScores = !visibility.publicShowScores && !isOwner;
    const visibleWatchlist = hideScores ? watchlist.map((i) => ({ ...i, score: null })) : watchlist;
    const showAvgScore = stats.avgScore != null && !hideScores;

    const displayName = user.name ?? "Anonymous";
    const totalItems = stats.totalShows + stats.totalMovies;

    // Only show podium section if owner OR at least one completed podium exists
    const anyPodium = Object.values(podiums).some((p) => p.length === 3);
    const showPodium = (isOwner || anyPodium) && (visibility.publicShowPodium || isOwner);
    const showActivity = visibility.publicShowActivity || isOwner;

    return (
        <div className="relative min-h-screen overflow-hidden">

            {/* The media and people pages' layout: a column on the left with who
                this is and the figures, in the same box as the media page's info
                block; the podium, the activity and the list on the right. */}
            <div className="container py-10 m-auto max-w-[80%] relative z-10 space-y-8 md:space-y-0 md:grid md:grid-cols-[260px_1fr] md:gap-8 md:items-start">
                <aside className="space-y-4">
                    <div className="flex items-center gap-3 md:flex-col md:items-start">
                        <span
                            aria-hidden
                            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-surface-3 font-display text-2xl font-semibold text-fg-soft"
                        >
                            {displayName.charAt(0).toUpperCase()}
                        </span>
                        <h1 className="font-display text-2xl font-bold tracking-tight text-fg">{displayName}</h1>
                    </div>

                    {totalItems > 0 && (
                        <div className="rounded-lg bg-box p-4 flex flex-col gap-3.5">
                            <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-line-soft">
                                <div>
                                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">{stats.totalShows}</div>
                                    <div className="mt-0.5 text-xs text-fg-dim">shows</div>
                                </div>
                                <div>
                                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">{stats.totalMovies}</div>
                                    <div className="mt-0.5 text-xs text-fg-dim">movies</div>
                                </div>
                                <div>
                                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">{formatWatchTime(stats.watchTimeMinutes)}</div>
                                    <div className="mt-0.5 text-xs text-fg-dim">watched</div>
                                </div>
                                {showAvgScore && stats.avgScore != null && (
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">
                                            <Star className="h-4 w-4 fill-current text-yellow-400" />
                                            {stats.avgScore.toFixed(1)}
                                        </div>
                                        <div className="mt-0.5 text-xs text-fg-dim">average score</div>
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
                                {Object.entries(stats.statusBreakdown)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([status, count]) => (
                                        <div key={status} className="contents">
                                            <span className="text-fg-dim">{status}</span>
                                            <span className="text-fg-soft tabular-nums">{count}</span>
                                        </div>
                                    ))}
                                {stats.topGenres.length > 0 && (
                                    <>
                                        <span className="text-fg-dim">Top genres</span>
                                        <span className="text-fg-soft">{stats.topGenres.map((g) => g.name).join(" · ")}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                <div className="space-y-8 min-w-0">
                    {showPodium && (
                        <PodiumSection
                            podiums={podiums}
                            isOwner={isOwner}
                            profileUserId={id}
                            watchlist={watchlist}
                        />
                    )}

                    {showActivity && activity.length > 0 && (
                        <div>
                            <h2 className="font-display text-lg font-semibold text-fg mb-2">Recent activity</h2>
                            <PublicActivityFeed items={activity} />
                        </div>
                    )}

                    <div>
                        <h2 className="font-display text-lg font-semibold text-fg mb-3">Watchlist</h2>
                        {visibleWatchlist.length === 0 ? (
                            <p className="text-fg-dim text-sm">This watchlist is empty.</p>
                        ) : (
                            <WatchlistTable items={visibleWatchlist} readOnly />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
