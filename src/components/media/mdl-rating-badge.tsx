import { getMdlData } from "@/lib/mdl-data";

interface Props {
    externalId: string;
    title: string;
    year: string;
}

// Async server component — streams in the MDL rating badge inline next to TMDB rating.
// Renders nothing while pending (fallback={null} in the Suspense wrapper).
export async function MdlRatingBadge({ externalId, title, year }: Props) {
    const data = await getMdlData(externalId, title, year);
    if (!data?.mdlRating) return null;

    return (
        <>
            <span>•</span>
            <span className="text-sky-400 font-medium">MDL {data.mdlRating.toFixed(1)}</span>
        </>
    );
}
