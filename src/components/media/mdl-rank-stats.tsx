import { cache } from "react";
import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { getMdlRatingHistory } from "@/lib/mdl-rating-history";
import { MdlLiveValue } from "./mdl-live-value";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
}

type Tone = "up" | "down" | "flat";
type Delta = { text: string; tone: Tone };
type Trend = { rank: Delta | null; watchers: Delta | null };

// Grey either way: the arrow and the sign already say which way it went. Green
// and red on top made the box the loudest thing on the page.
const TONE: Record<Tone, string> = { up: "text-fg-muted", down: "text-fg-muted", flat: "text-fg-dim" };


// The window the trend line covers, and the least history it needs to say
// anything: a two-day gap between readings is not a trend.
const TREND_DAYS = 30;
const MIN_SPAN_DAYS = 7;

function compact(n: number): string {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

/**
 * How rank and audience moved over the last month, from the daily readings.
 *
 * This replaced the "Rating history" section. MDL rounds the score to a tenth,
 * so once a show has settled its line was flat for good, while rank and
 * watchers — which do move — sat unlabelled behind it. The score's own history
 * stays behind the trend icon beside it in the title line.
 *
 * Readings are missing on the days nobody looked, so the delta runs from the
 * first reading inside the window to the last one, and says how many days that
 * actually spans.
 */
export const getTrend = cache(async (mdlSlug: string): Promise<Trend> => {
    const history = await getMdlRatingHistory(mdlSlug, TREND_DAYS);
    const ranked = history.filter((p) => p.ranking != null);
    const watched = history.filter((p) => p.watchers != null);

    const spanDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

    let rank: Delta | null = null;
    if (ranked.length >= 2) {
        const first = ranked[0];
        const last = ranked[ranked.length - 1];
        const days = spanDays(first.day, last.day);
        if (days >= MIN_SPAN_DAYS) {
            const climb = (first.ranking as number) - (last.ranking as number);
            const from = first.ranking as number;
            const to = last.ranking as number;
            // A new show enters MDL's ranking tens of thousands of places down
            // and climbs as votes arrive: "▲ 36776" is true and says nothing.
            // Past a fivefold climb it is a newcomer; past a twofold move, the
            // rank it came from reads better than the distance.
            rank =
                climb === 0
                    ? { text: `no change in ${days} days`, tone: "flat" }
                    : from >= to * 5
                      ? { text: "new in the ranking", tone: "up" }
                      : from >= to * 2
                        ? { text: `up from #${from.toLocaleString("en-US")}`, tone: "up" }
                        : to >= from * 2
                          ? { text: `down from #${from.toLocaleString("en-US")}`, tone: "down" }
                          : { text: `${climb > 0 ? "▲" : "▼"} ${Math.abs(climb).toLocaleString("en-US")} in ${days} days`, tone: climb > 0 ? "up" : "down" };
        }
    }

    let watchers: Delta | null = null;
    if (watched.length >= 2) {
        const first = watched[0];
        const last = watched[watched.length - 1];
        const days = spanDays(first.day, last.day);
        const gained = (last.watchers as number) - (first.watchers as number);
        if (days >= MIN_SPAN_DAYS && gained !== 0)
            watchers = { text: `${gained > 0 ? "+" : "−"}${compact(Math.abs(gained))} in ${days} days`, tone: gained > 0 ? "up" : "down" };
    }

    return { rank, watchers };
});

// The two MDL figures at the head of the sidebar's info block, set large. They
// are the numbers people scan this box for; the rest is a list under them.
export function RankStats({ rank, watchers, trend }: { rank: React.ReactNode; watchers: React.ReactNode; trend?: Trend }) {
    return (
        <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-line-soft">
            {rank ? (
                <div>
                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-sky-400 tabular-nums">{rank}</div>
                    <div className="mt-0.5 text-xs text-fg-dim">MDL rank</div>
                    {trend?.rank && <div className={`mt-1 text-xs tabular-nums ${TONE[trend.rank.tone]}`}>{trend.rank.text}</div>}
                </div>
            ) : null}
            {watchers ? (
                <div>
                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">{watchers}</div>
                    <div className="mt-0.5 text-xs text-fg-dim">watchers</div>
                    {trend?.watchers && <div className={`mt-1 text-xs tabular-nums ${TONE[trend.watchers.tone]}`}>{trend.watchers.text}</div>}
                </div>
            ) : null}
        </div>
    );
}

export function RankStatsFallback() {
    return (
        <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-line-soft">
            {[0, 1].map((i) => (
                <div key={i}>
                    <div className="h-[27px] w-16 rounded bg-surface-3 animate-pulse" />
                    <div className="mt-1 h-3 w-12 rounded bg-surface-2" />
                </div>
            ))}
        </div>
    );
}

// Async server component — streams the season's MDL rank and watcher count.
export async function MdlRankStats({ externalId, title, year, nativeTitle, season }: Props) {
    const data = season && season > 1
        ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
        : await getMdlData(externalId, title, year, nativeTitle);
    if (!data?.mdlRanking && !data?.mdlWatchers) return null;

    const scope = `${externalId}-${season ?? 1}`;
    const trend = data.mdlSlug ? await getTrend(data.mdlSlug) : undefined;

    return (
        <RankStats
            rank={data.mdlRanking ? <MdlLiveValue field="ranking" initial={data.mdlRanking} scope={scope} /> : null}
            watchers={data.mdlWatchers ? <MdlLiveValue field="watchers" initial={data.mdlWatchers} scope={scope} /> : null}
            trend={trend}
        />
    );
}

// The same figures for a page built from MDL alone, where the numbers are
// already in hand and only the trend has to be read.
export async function MdlNativeRankStats({ mdlSlug, rank, watchers }: { mdlSlug: string; rank: string | null; watchers: string | null }) {
    const trend = await getTrend(mdlSlug);
    return <RankStats rank={rank} watchers={watchers} trend={trend} />;
}
