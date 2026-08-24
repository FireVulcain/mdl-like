import { MetaLinkList, GENRE_LIST } from "./meta-link-list";

/**
 * The Genres heading and its run of names.
 *
 * Shared because the same block is now drawn from two vocabularies. MDL genres
 * link into /dramas, which browses MDL; TMDB ones cannot, since a show with no
 * MDL entry has nothing on the other end of that link. They are still worth
 * printing — a page that simply omits its genres reads as a page whose genres
 * are unknown — so they render in the same style, minus the link.
 */
export function GenreBlock({ genres, hrefFor }: { genres: string[]; hrefFor?: (genre: string) => string | undefined }) {
    if (genres.length === 0) return null;
    return (
        <div className="mt-6">
            <h3 className="font-display text-lg font-semibold mb-2">Genres</h3>
            <MetaLinkList
                {...GENRE_LIST}
                items={genres.map((genre) => ({ key: genre, label: genre, href: hrefFor?.(genre) }))}
            />
        </div>
    );
}
