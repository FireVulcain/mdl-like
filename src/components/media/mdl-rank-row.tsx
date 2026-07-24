import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
}

// Async server component — streams MDL Rank and Watchers as grid cells (label +
// value pairs). Suspense adds no DOM nodes, so the fragment children slot directly
// into the parent grid.
export async function MdlRankRow({ externalId, title, year, nativeTitle, season }: Props) {
    const data = season && season > 1
        ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
        : await getMdlData(externalId, title, year, nativeTitle);
    if (!data?.mdlRanking && !data?.mdlWatchers) return null;

    return (
        <>
            {data.mdlRanking && (
                <>
                    <span className="text-gray-400 font-medium">MDL Rank</span>
                    <span className="text-sky-400 font-medium">#{data.mdlRanking}</span>
                </>
            )}
            {data.mdlWatchers ? (
                <>
                    <span className="text-gray-400 font-medium">Watchers</span>
                    <span className="text-white">{data.mdlWatchers.toLocaleString("en-US")}</span>
                </>
            ) : null}
        </>
    );
}
