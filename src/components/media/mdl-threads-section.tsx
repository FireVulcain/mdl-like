import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { kuryanaGetThreads } from "@/lib/kuryana";
import { MdlThreads } from "./mdl-threads";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
    mdlSlug?: string; // When provided, skips the TMDB→MDL slug lookup (for MDL-native pages)
}

// Async server component — streams in MDL live comments.
// getMdlData uses React cache(), so the slug lookup is free if other MDL components resolved it first.
export async function MdlThreadsSection({ externalId, title, year, nativeTitle, season, mdlSlug: directSlug }: Props) {
    let slug = directSlug;
    if (!slug) {
        const mdlData = season && season > 1
            ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
            : await getMdlData(externalId, title, year, nativeTitle);
        slug = mdlData?.mdlSlug;
    }
    if (!slug) return null;

    // The threads endpoint takes only the numeric drama ID (e.g., "687393"),
    // not the full slug (e.g., "687393-prisoner-of-beauty").
    const mdlId = slug.match(/^(\d+)/)?.[1];
    if (!mdlId) return null;

    const result = await kuryanaGetThreads(mdlId);
    if (!result || result.disabled || !result.comments || result.comments.length === 0) return null;

    return (
        <MdlThreads
            key={mdlId}
            initialComments={result.comments}
            total={result.total}
            hasMore={result.has_more}
            mdlId={mdlId}
        />
    );
}
