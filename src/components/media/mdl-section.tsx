import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { MdlCastScroll } from "./mdl-cast-scroll";
import { CastScroll } from "./cast-scroll";
import { SynopsisBlock } from "./synopsis-block";
import Link from "next/link";

// Matches the MDL_GENRES values in /dramas
const VALID_DRAMA_GENRE_SLUGS = new Set([
    "action","adventure","animals","business","comedy","crime","detective",
    "documentary","drama","family","fantasy","food","friendship","historical",
    "horror","investigation","law","life","manga","martial_arts","mature",
    "medical","melodrama","military","music","mystery","political","psychological",
    "romance","school","sci_fi","sitcom","sports","supernatural","suspense",
    "thriller","tokusatsu","tragedy","vampire","war","western","wuxia","youth","zombies",
]);

function genreToSlug(genre: string): string {
    return genre.toLowerCase().replace(/[\s-]+/g, "_");
}

interface Actor {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

interface Props {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    tmdbCast: Actor[];
    mediaId: string;
    season?: number;
    tmdbSynopsis: string;
    originCountry?: string;
}

// Async server component — streams in MDL synopsis + tags + cast.
// The Suspense fallback (TMDB synopsis + TMDB cast) shows immediately; this swaps in when Kuryana responds.
export async function MdlSection({ externalId, title, year, nativeTitle, tmdbCast, mediaId, season, tmdbSynopsis, originCountry }: Props) {
    const data = season && season > 1
        ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
        : await getMdlData(externalId, title, year, nativeTitle);

    const synopsis = data?.synopsis || tmdbSynopsis;

    return (
        <>
            <SynopsisBlock text={synopsis} />

            {data?.genres && data.genres.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Genres</h3>
                    <div className="flex flex-wrap gap-2">
                        {data.genres.map((genre) => {
                            const slug = genreToSlug(genre);
                            const pillClass = "px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sm text-sky-300/80 hover:text-sky-200 hover:border-sky-400/30 transition-colors";
                            const countryParam = originCountry ? `&country=${originCountry}` : "";
                            return VALID_DRAMA_GENRE_SLUGS.has(slug) ? (
                                <Link
                                    key={genre}
                                    href={`/dramas?genre=${slug}${countryParam}`}
                                    className={pillClass}
                                >
                                    {genre}
                                </Link>
                            ) : (
                                <span key={genre} className={pillClass}>{genre}</span>
                            );
                        })}
                    </div>
                </div>
            )}

            {data?.tags && data.tags.length > 0 && (
                <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {data.tags.map((tag) => (
                            <span
                                key={tag}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white/90 hover:border-white/20 transition-colors"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className={(data?.tags && data.tags.length > 0) || (data?.genres && data.genres.length > 0) ? "mt-6" : undefined}>
                {data?.cast ? (
                    <MdlCastScroll cast={data.cast} tmdbCast={tmdbCast} mediaId={mediaId} />
                ) : (
                    <CastScroll cast={tmdbCast} mediaId={mediaId} />
                )}
            </div>
        </>
    );
}
