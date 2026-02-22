import { getMdlData } from "@/lib/mdl-data";

interface Props {
    externalId: string;
    title: string;
    year: string;
}

// Async server component — streams in two grid cells (label + value) for MDL Rank.
// Suspense doesn't add DOM nodes, so the fragment children slot directly into the parent grid.
export async function MdlRankRow({ externalId, title, year }: Props) {
    const data = await getMdlData(externalId, title, year);
    if (!data?.mdlRanking) return null;

    return (
        <>
            <span className="text-gray-400 font-medium">MDL Rank</span>
            <span className="text-sky-400 font-medium">#{data.mdlRanking}</span>
        </>
    );
}
