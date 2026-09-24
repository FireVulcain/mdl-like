import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { MdlLiveValue } from "./mdl-live-value";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
}

// The two MDL figures at the head of the sidebar's info block, set large. They
// are the numbers people scan this box for; the rest is a list under them.
export function RankStats({ rank, watchers }: { rank: React.ReactNode; watchers: React.ReactNode }) {
    return (
        <div className="grid grid-cols-2 gap-3 pb-3.5 border-b border-line-soft">
            {rank ? (
                <div>
                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-sky-400 tabular-nums">{rank}</div>
                    <div className="mt-0.5 text-xs text-fg-dim">MDL rank</div>
                </div>
            ) : null}
            {watchers ? (
                <div>
                    <div className="text-[22px] font-semibold leading-tight tracking-tight text-fg tabular-nums">{watchers}</div>
                    <div className="mt-0.5 text-xs text-fg-dim">watchers</div>
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

    return (
        <RankStats
            rank={data.mdlRanking ? <MdlLiveValue field="ranking" initial={data.mdlRanking} scope={scope} /> : null}
            watchers={data.mdlWatchers ? <MdlLiveValue field="watchers" initial={data.mdlWatchers} scope={scope} /> : null}
        />
    );
}
