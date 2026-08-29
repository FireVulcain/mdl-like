import { notFound } from "next/navigation";
import { getPublicUser, getPublicActivity, getPublicStats } from "@/actions/public-profile";
import { getProfileVisibility } from "@/actions/preferences";
import { getPublicWatchlist } from "@/actions/media";
import { getPublicPodiums } from "@/actions/podium";
import { WatchlistTable } from "@/components/watchlist-table";
import { PublicActivityFeed } from "@/components/public-activity-feed";
import { PodiumSection } from "@/components/podium-section";
import { CollapsibleSection } from "@/components/collapsible-section";
import { Star, Clock } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageBackground } from "@/components/page-background";
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
            <PageBackground />

            {/* Content */}
            <div className="container py-10 m-auto max-w-[80%] relative z-10 space-y-8">

                {/* Header */}
                <div>
                    <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
                        {displayName}&apos;s Watchlist
                    </h1>
                    <p className="mt-1 text-fg-muted text-sm">
                        {stats.totalShows} show{stats.totalShows !== 1 ? "s" : ""} ·{" "}
                        {stats.totalMovies} movie{stats.totalMovies !== 1 ? "s" : ""} ·{" "}
                        {formatWatchTime(stats.watchTimeMinutes)} watched
                    </p>
                </div>

                {/* Stats row */}
                {totalItems > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {showAvgScore && stats.avgScore != null && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-line">
                                <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                                <div>
                                    <p className="text-xs text-fg-muted leading-none">Avg score</p>
                                    <p className="text-fg font-semibold text-sm">{stats.avgScore.toFixed(1)}</p>
                                </div>
                            </div>
                        )}
                        {Object.entries(stats.statusBreakdown)
                            .sort((a, b) => b[1] - a[1])
                            .map(([status, count]) => (
                                <div key={status} className="px-4 py-2.5 rounded-xl bg-surface-2 border border-line">
                                    <p className="text-xs text-fg-muted leading-none">{status}</p>
                                    <p className="text-fg font-semibold text-sm">{count}</p>
                                </div>
                            ))}
                        {stats.topGenres.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-2 border border-line">
                                <span className="text-xs text-fg-muted mr-1">Top genres:</span>
                                {stats.topGenres.map((g) => (
                                    <span key={g.name} className="text-xs px-2 py-0.5 rounded-md bg-surface-3 text-fg-soft">
                                        {g.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Podium */}
                {showPodium && (
                    <PodiumSection
                        podiums={podiums}
                        isOwner={isOwner}
                        profileUserId={id}
                        watchlist={watchlist}
                    />
                )}

                {/* Recent Activity — collapsible */}
                {showActivity && activity.length > 0 && (
                    <CollapsibleSection
                        title="Recent Activity"
                        icon={<Clock className="h-4 w-4 text-fg-muted" />}
                        defaultOpen={false}
                    >
                        <PublicActivityFeed items={activity} />
                    </CollapsibleSection>
                )}

                {/* Watchlist */}
                <div>
                    <h2 className="font-display text-lg font-bold text-fg mb-3">Watchlist</h2>
                    {visibleWatchlist.length === 0 ? (
                        <p className="text-fg-dim text-sm">This watchlist is empty.</p>
                    ) : (
                        <WatchlistTable items={visibleWatchlist} readOnly />
                    )}
                </div>
            </div>
        </div>
    );
}
