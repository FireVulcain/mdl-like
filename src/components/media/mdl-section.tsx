import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { MdlCastScroll } from "./mdl-cast-scroll";
import { CastScroll } from "./cast-scroll";
import { SynopsisBlock } from "./synopsis-block";
import { MetaLinkList, TAG_LIST } from "./meta-link-list";
import { GenreBlock } from "./genre-block";

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
    // Fallback for shows MDL has no entry for
    tmdbGenres?: string[];
}

// Async server component — streams in MDL synopsis + tags + cast.
// The Suspense fallback (TMDB synopsis + TMDB cast) shows immediately; this swaps in when Kuryana responds.
export async function MdlSection({ externalId, title, year, nativeTitle, tmdbCast, mediaId, season, tmdbSynopsis, originCountry, tmdbGenres }: Props) {
    const data = season && season > 1
        ? (await getMdlSeasonData(externalId, season)) ?? await getMdlData(externalId, title, year, nativeTitle)
        : await getMdlData(externalId, title, year, nativeTitle);

    const synopsis = data?.synopsis || tmdbSynopsis;

    return (
        <>
            <SynopsisBlock text={synopsis} />

            {/* MDL genres link into /dramas. Where MDL has no entry for the show
                its TMDB genres stand in, unlinked — /dramas browses MDL, so there
                is nothing for them to point at. Better than the heading vanishing
                and the page reading as though its genres were unknown. */}
            {data?.genres && data.genres.length > 0 ? (
                <GenreBlock
                    genres={data.genres}
                    hrefFor={(genre) => {
                        const slug = genreToSlug(genre);
                        const countryParam = originCountry ? `&country=${originCountry}` : "";
                        return VALID_DRAMA_GENRE_SLUGS.has(slug) ? `/dramas?genre=${slug}${countryParam}` : undefined;
                    }}
                />
            ) : (
                <GenreBlock genres={tmdbGenres ?? []} />
            )}

            {data?.tags && data.tags.length > 0 && (
                <div className="mt-6">
                    <h3 className="font-display text-lg font-semibold mb-2">Tags</h3>
                    {/* Dimmer than the genres: there are three times as many, and
                        they qualify the show rather than classify it. */}
                    <MetaLinkList
                        {...TAG_LIST}
                        items={data.tags.map((tag) => ({
                            key: String(tag.id > 0 ? tag.id : tag.name),
                            label: tag.name,
                            href: tag.id > 0 ? `/dramas?tag=${tag.id}&tag_name=${encodeURIComponent(tag.name)}` : undefined,
                        }))}
                    />
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
