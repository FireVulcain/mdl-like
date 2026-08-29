import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { formatAiredRange } from "@/lib/format-aired";

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
    // TMDB's own range, shown when MDL has nothing for this entry
    fallback?: string;
}

/**
 * The "Aired" row, season-aware.
 *
 * TMDB only exposes first_air_date / last_air_date at SHOW level, so every
 * season of a multi-season show reported the same range — season 2 of a 2026
 * revival still read "2024-01-26 - Present". MDL files each season as its own
 * entry, so its range is the only per-season source we have.
 *
 * getMdlData/getMdlSeasonData are wrapped in React cache(), so sharing them
 * with MdlRankRow costs no second fetch.
 */
export async function MdlAiredRow({ externalId, title, year, nativeTitle, season, fallback }: Props) {
    const data =
        season && season > 1
            ? ((await getMdlSeasonData(externalId, season)) ?? (await getMdlData(externalId, title, year, nativeTitle)))
            : await getMdlData(externalId, title, year, nativeTitle);

    const aired = formatAiredRange(data?.aired) || fallback;
    if (!aired) return null;

    return (
        <>
            <span className="text-fg-muted font-medium">Aired</span>
            <span className="text-fg">{aired}</span>
        </>
    );
}
