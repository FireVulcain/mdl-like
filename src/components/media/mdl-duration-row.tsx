import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
    // TMDB's own figure, shown as-is when it has one
    fallback?: string;
}

/**
 * The "Duration" row, season-aware.
 *
 * TMDB leaves episode_run_time empty on most dramas, so the row simply went
 * missing on the pages where the reader most expects it. MDL states a running
 * time on every entry, and since it files each season on its own, a season 2
 * that runs longer than its first gets its own number.
 *
 * TMDB's figure wins where it exists — it is what the rest of the panel comes
 * from — and MDL fills the gap. getMdlData/getMdlSeasonData are wrapped in
 * React cache(), so this costs no fetch beside MdlAiredRow.
 */
export async function MdlDurationRow({ externalId, title, year, nativeTitle, season, fallback }: Props) {
    const data =
        season && season > 1
            ? ((await getMdlSeasonData(externalId, season)) ?? (await getMdlData(externalId, title, year, nativeTitle)))
            : await getMdlData(externalId, title, year, nativeTitle);

    const duration = fallback || data?.duration || null;
    if (!duration) return null;

    return (
        <>
            <span className="text-fg-muted font-medium">Duration</span>
            <span className="text-fg">{duration}</span>
        </>
    );
}
