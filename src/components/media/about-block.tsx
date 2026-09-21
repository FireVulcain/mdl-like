import type { ReactNode } from "react";
import { SynopsisBlock } from "./synopsis-block";
import { MetaLinkList, GENRE_LIST, TAG_LIST, type MetaItem } from "./meta-link-list";

/**
 * One row of the lede's table: a label in the gutter, the run beside it. The
 * same two-column grammar as the sidebar's fact box, so the two read as one
 * family. `pt-0.5` lines a text-sm label up with a text-base run.
 */
export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid grid-cols-[88px_1fr] gap-x-3 items-start">
            <span className="pt-0.5 text-sm font-medium text-fg-muted">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/**
 * The lede of a media page: the synopsis, then what the show is filed under.
 *
 * Related content, genres and tags each had a heading of their own — four
 * headings in six hundred pixels before the cast, every one at the same size
 * as Cast and Episodes below. They are facts about the show, not sections of
 * the page, and they take the form facts take here: a label, a run.
 *
 * The synopsis keeps no heading either. It sits directly under the title and
 * the jump strip, and a paragraph in that position is the synopsis; saying so
 * only pushed it down.
 */
export function AboutBlock({ synopsis, related, genres, tags }: { synopsis: string; related?: ReactNode; genres: MetaItem[]; tags?: MetaItem[] }) {
    const hasMeta = !!related || genres.length > 0 || (tags?.length ?? 0) > 0;
    return (
        <div className="space-y-5">
            {synopsis && <SynopsisBlock text={synopsis} heading={false} />}
            {hasMeta && (
                <div className="space-y-2.5">
                    {related}
                    {genres.length > 0 && (
                        <MetaRow label="Genres">
                            <MetaLinkList {...GENRE_LIST} items={genres} />
                        </MetaRow>
                    )}
                    {tags && tags.length > 0 && (
                        <MetaRow label="Tags">
                            <MetaLinkList {...TAG_LIST} items={tags} />
                        </MetaRow>
                    )}
                </div>
            )}
        </div>
    );
}
