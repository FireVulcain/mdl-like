import type { ReactNode } from "react";
import { MediaNav, type NavSection } from "./media-nav";

/**
 * One section of a media page: where it scrolls to, what the nav calls it,
 * and what it draws. `label` is optional — the lede at the top of the page
 * (synopsis, genres, tags) is a section without a jump.
 */
export interface MediaSectionDef {
    id: string;
    label?: string;
    node: ReactNode;
}

/**
 * A tier is a group of sections that belong together: what the show *is*,
 * what is *in* it, what people *say* about it. The nav divides at the same
 * places the page does.
 */
export interface MediaTier {
    key: string;
    sections: MediaSectionDef[];
}

/**
 * Every section of a media page, drawn from one list.
 *
 * The page used to keep two copies of its structure: the nav's array of ids
 * and labels, and the JSX below it, each section wrapped by hand in the same
 * "border-t border-line pt-8" div. Adding a section meant editing both, and
 * they had drifted — "Cast" in the nav jumped to the synopsis. Here the list is
 * the page: the nav reads its entries off it, and every section gets the same
 * wrapper, so one cannot be styled differently from the next by accident.
 *
 * Sections inside a tier are separated by a hairline (the .media-tier rule in
 * globals.css, which skips the ones that resolved to nothing). Tiers are
 * separated by more room and a stronger rule — no label, since "Community"
 * over a Reviews heading says nothing the heading does not.
 *
 * `empty:hidden` on the wrapper: most sections stream in behind Suspense and
 * resolve to nothing when MDL has nothing for them, and an empty section must
 * not leave its padding behind.
 */
export function MediaSections({ tiers }: { tiers: MediaTier[] }) {
    const groups = tiers
        .map((tier) =>
            tier.sections
                .filter((s): s is MediaSectionDef & { label: string } => !!s.label)
                .map(({ id, label }): NavSection => ({ id, label })),
        )
        .filter((g) => g.length > 0);

    return (
        <>
            <MediaNav groups={groups} />
            {tiers.map((tier, t) => (
                <div key={tier.key} className={`media-tier space-y-8 ${t > 0 ? "mt-14 border-t border-line-strong pt-10" : ""}`}>
                    {tier.sections.map((s) => (
                        // scroll-mt: room for the sticky nav when a jump lands here.
                        <section key={s.id} id={s.id} className="scroll-mt-32 empty:hidden">
                            {s.node}
                        </section>
                    ))}
                </div>
            ))}
        </>
    );
}
