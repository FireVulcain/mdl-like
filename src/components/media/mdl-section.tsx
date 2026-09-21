import { getMdlData, getMdlSeasonData } from "@/lib/mdl-data";
import { MdlCastScroll } from "./mdl-cast-scroll";
import { CastScroll } from "./cast-scroll";
import { AboutBlock } from "./about-block";
import { MdlRelatedContent } from "./mdl-related-content";
import { Suspense } from "react";

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

interface MdlLookup {
    externalId: string;
    title: string;
    year: string;
    nativeTitle?: string;
    season?: number;
}

// One lookup for both halves. getMdlData is wrapped in cache(), so the second
// component to ask gets the first one's answer.
function lookup({ externalId, title, year, nativeTitle, season }: MdlLookup) {
    return season && season > 1
        ? getMdlSeasonData(externalId, season).then((d) => d ?? getMdlData(externalId, title, year, nativeTitle))
        : getMdlData(externalId, title, year, nativeTitle);
}

/**
 * The lede of a TMDB page once MDL has answered: MDL's synopsis, related
 * content, genres and tags, with TMDB's synopsis and genres standing in
 * wherever MDL has nothing.
 *
 * This and the cast below used to be one component, because they come from
 * one fetch. They are two sections of the page now — the nav's "Cast" was
 * landing on the synopsis — and the cache makes the split free.
 */
export async function MdlAboutSection({ tmdbSynopsis, originCountry, tmdbGenres, ...look }: MdlLookup & { tmdbSynopsis: string; originCountry?: string; tmdbGenres?: string[] }) {
    const data = await lookup(look);

    // MDL genres link into /dramas. Where MDL has no entry for the show its
    // TMDB genres stand in, unlinked — /dramas browses MDL, so there is
    // nothing for them to point at. Better than the row vanishing and the
    // page reading as though its genres were unknown.
    const mdlGenres = data?.genres ?? [];
    const genres =
        mdlGenres.length > 0
            ? mdlGenres.map((genre) => {
                  const slug = genreToSlug(genre);
                  const countryParam = originCountry ? `&country=${originCountry}` : "";
                  return { key: genre, label: genre, href: VALID_DRAMA_GENRE_SLUGS.has(slug) ? `/dramas?genre=${slug}${countryParam}` : undefined };
              })
            : (tmdbGenres ?? []).map((genre) => ({ key: genre, label: genre }));

    const tags = (data?.tags ?? []).map((tag) => ({
        key: String(tag.id > 0 ? tag.id : tag.name),
        label: tag.name,
        href: tag.id > 0 ? `/dramas?tag=${tag.id}&tag_name=${encodeURIComponent(tag.name)}` : undefined,
    }));

    return (
        <AboutBlock
            synopsis={data?.synopsis || tmdbSynopsis}
            // Its own boundary: one more MDL round trip, and the rows below
            // it have no reason to wait for it.
            related={
                data?.mdlSlug ? (
                    <Suspense fallback={null}>
                        <MdlRelatedContent mdlSlug={data.mdlSlug} />
                    </Suspense>
                ) : undefined
            }
            genres={genres}
            tags={tags}
        />
    );
}

/** The cast of a TMDB page once MDL has answered: MDL's grouped list, TMDB's behind a toggle. */
export async function MdlCastSection({ tmdbCast, mediaId, ...look }: MdlLookup & { tmdbCast: Actor[]; mediaId: string }) {
    const data = await lookup(look);
    return data?.cast ? <MdlCastScroll cast={data.cast} tmdbCast={tmdbCast} mediaId={mediaId} /> : <CastScroll cast={tmdbCast} mediaId={mediaId} />;
}
