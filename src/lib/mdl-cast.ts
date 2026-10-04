import type { KuryanaCastMember } from "@/lib/kuryana";
import type { MdlCast, MdlCastMember } from "@/lib/mdl-data";

function normalizeMembers(members: KuryanaCastMember[] | undefined): MdlCastMember[] {
    return (members ?? []).map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: (m.role?.type ?? "Support Role") as MdlCastMember["roleType"],
    }));
}

/**
 * The cast as stored in castJson, from the scraper's cast answer — every
 * writer goes through here.
 *
 * There were six copies of this, and four left out MDL's "Cameo" section. The
 * sync, "Refresh cache", season links and the backfills each rewrote the cast
 * without it: 488 of 1,090 rows had lost their cameos by 2026-10-04. And
 * getMdlData reads a cast with no cameo key as incomplete, so every visit to
 * such a page re-scraped it, until the next sync wiped the cameos again.
 */
export function normalizeMdlCast(casts: Record<string, KuryanaCastMember[] | undefined>): MdlCast {
    return {
        main: normalizeMembers(casts["Main Role"]),
        support: normalizeMembers(casts["Support Role"]),
        guest: normalizeMembers(casts["Guest Role"]),
        cameo: normalizeMembers(casts["Cameo"]),
    };
}
