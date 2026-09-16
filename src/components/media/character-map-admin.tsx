import { isAdminUser } from "@/lib/admin";
import { latestJob } from "@/lib/character-map-jobs";
import { getCharacterMap } from "@/lib/character-map-store";
import { countryCode } from "@/lib/character-map-inputs";
import { CharacterMapGenerateButton } from "./character-map-generate-button";

/**
 * Server half of the generate button: decides whether the reader is the
 * admin and hands the button the last run for this entry. Renders nothing
 * for anyone else, and nothing when the entry has no MDL slug to write from.
 */
export async function CharacterMapAdmin({ mdlSlug, hasChart }: { mdlSlug: string | null | undefined; hasChart: boolean }) {
    if (!mdlSlug || !(await isAdminUser())) return null;
    const [job, map] = await Promise.all([latestJob(mdlSlug), hasChart ? getCharacterMap(mdlSlug) : null]);
    // A Korean or Japanese chart with no still yet is one the extension can
    // dress on this visit — asianwiki barely covers China, so those are not asked
    const needsStills = !!map && ["KR", "JP"].includes(countryCode(map.country ?? "")) && !map.people.some((p) => p.still);
    return <CharacterMapGenerateButton mdlSlug={mdlSlug} hasChart={hasChart} initialJob={job} needsStills={needsStills} />;
}

/** The section a media page shows the admin when there is no chart yet: just the button. */
export async function CharacterMapEmptyAdmin({ mdlSlug }: { mdlSlug: string | null | undefined }) {
    if (!mdlSlug || !(await isAdminUser())) return null;
    const job = await latestJob(mdlSlug);
    return (
        <div id="section-relationships" className="border-t border-line pt-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <h2 className="font-display text-lg font-semibold text-fg">Relationships</h2>
                    <span className="text-sm text-fg-muted">none yet</span>
                </div>
                <CharacterMapGenerateButton mdlSlug={mdlSlug} hasChart={false} initialJob={job} />
            </div>
        </div>
    );
}
