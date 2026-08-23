import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { MdlLiveValue } from "./mdl-live-value";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
}

// Async server component — streams in the MDL rating badge inline next to TMDB rating.
// Renders nothing while pending (fallback={null} in the Suspense wrapper).
export async function MdlRatingBadge({ externalId, title, year, nativeTitle, season }: Props) {
    const data = season && season > 1
        ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
        : await getMdlData(externalId, title, year, nativeTitle);
    if (!data?.mdlRating) return null;

    return (
        <>
            <span>•</span>
            <span className="text-sky-400 font-medium">
                MDL <MdlLiveValue field="rating" initial={data.mdlRating} scope={`${externalId}-${season ?? 1}`} />
            </span>
        </>
    );
}
