import React from "react";
import Link from "next/link";
import { kuryanaGetDetails } from "@/lib/kuryana";
import { resolveMdlHrefs } from "@/lib/mdl-links";
import { MetaRow } from "./about-block";

/**
 * MDL's "Related Content": the prequels, spin-offs, behind-the-scenes and
 * compilations filed against a show. Placed where MDL places it, directly under
 * the synopsis, because the note ("Chinese original story") only means anything
 * next to the story it qualifies. One row of the lede's table, written as a
 * run like the genres under it rather than a list with a heading of its own.
 *
 * Every entry links back into this site — the TMDB page where the slug is
 * linked, the MDL-native page otherwise. MDL's own absolute URL is not used.
 */
export async function MdlRelatedContent({ mdlSlug }: { mdlSlug: string }) {
    const details = await kuryanaGetDetails(mdlSlug);
    const related = details?.data?.others?.related_content ?? [];
    if (related.length === 0) return null;

    // MDL occasionally files the same entry under two notes; the first wins.
    const seen = new Set<string>();
    const items = related.filter((r) => r.id && !seen.has(r.id) && seen.add(r.id));
    if (items.length === 0) return null;

    const hrefs = await resolveMdlHrefs(items.map((r) => r.id));

    return (
        <MetaRow label="Related">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-fg-muted">
                {items.map((item, i) => (
                    <React.Fragment key={item.id}>
                        {i > 0 && (
                            <span aria-hidden className="text-fg-faint">
                                ·
                            </span>
                        )}
                        <span>
                            <Link href={hrefs.get(item.id) ?? `/media/mdl-${item.id}`} className="text-sky-300 hover:text-sky-200 transition-colors">
                                {item.name}
                            </Link>
                            {item.note && <span className="text-fg-dim"> ({item.note})</span>}
                        </span>
                    </React.Fragment>
                ))}
            </p>
        </MetaRow>
    );
}
