import { mediaService } from "@/services/media.service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CastGallery, GalleryGroup } from "@/components/media/cast-gallery";
import type { Metadata } from "next";
import { mediaMetadata } from "@/lib/page-metadata";
import { kuryanaGetCast, KuryanaCastResult } from "@/lib/kuryana";
import { getMdlData, getMdlSeasonData, MdlCast, MdlCastMember } from "@/lib/mdl-data";
import { mdlPersonHref, tmdbPersonHref } from "@/lib/person-links";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    return mediaMetadata((await params).id, "Cast");
}

// Same list as the media page: the countries MDL covers well enough to trust its cast.
const MDL_COUNTRIES = new Set(["KR", "CN", "JP", "TW", "TH", "HK", "US"]);

// MDL's own words for its role groups, where they read oddly on their own.
const ROLE_LABELS: Record<string, string> = {
    "Main Role": "Main role",
    "Support Role": "Supporting",
    "Guest Role": "Guest",
    Unknown: "Other",
};

function mdlGroups(cast: MdlCast): GalleryGroup[] {
    const toPerson = (a: MdlCastMember) => ({
        key: a.slug,
        name: a.name,
        character: a.characterName,
        image: a.profileImage || null,
        href: mdlPersonHref(a.slug),
    });
    return [
        { label: "Main role", people: cast.main.map(toPerson) },
        { label: "Supporting", people: cast.support.map(toPerson) },
        { label: "Guest", people: cast.guest.map(toPerson) },
        { label: "Cameo", people: cast.cameo.map(toPerson) },
    ];
}

/**
 * Every section of MDL's cast page, in MDL's order: the crew (director,
 * screenwriter, composer…) first, then the roles. The cache keeps the four
 * role groups only, so the crew comes from a live read.
 */
function liveGroups(casts: KuryanaCastResult["data"]["casts"]): GalleryGroup[] {
    return Object.entries(casts).map(([key, members]) => ({
        label: ROLE_LABELS[key] ?? key,
        people: (members ?? []).map((m, i) => ({
            key: `${m.slug}-${i}`,
            name: m.name,
            character: m.role && m.role.name !== "Unknown" ? m.role.name : "",
            image: m.profile_image || null,
            href: mdlPersonHref(m.slug),
        })),
    }));
}

export default async function CastPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
    const [{ id }, { season }] = await Promise.all([params, searchParams]);
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    // MDL's cast page, crew included, for an MDL entry and for a TMDB entry MDL
    // covers (the season's own entry for S2+). The cached cast when the scraper
    // does not answer; TMDB's credits only when MDL has nothing.
    const selectedSeason = season ? parseInt(season) || 1 : 1;
    let mdlSlug: string | null = null;
    let cachedCast: MdlCast | null = null;
    if (media.source === "MDL") {
        mdlSlug = media.externalId;
    } else if (MDL_COUNTRIES.has(media.originCountry)) {
        const data =
            selectedSeason > 1
                ? ((await getMdlSeasonData(media.externalId, selectedSeason)) ?? (await getMdlData(media.externalId, media.title, media.year, media.nativeTitle)))
                : await getMdlData(media.externalId, media.title, media.year, media.nativeTitle);
        mdlSlug = data?.mdlSlug ?? null;
        cachedCast = data?.cast ?? null;
    }

    const live = mdlSlug ? await kuryanaGetCast(mdlSlug) : null;
    const mdlSections = live?.data?.casts ? liveGroups(live.data.casts) : cachedCast ? mdlGroups(cachedCast) : [];
    const hasMdlCast = mdlSections.some((g) => g.people.length > 0);

    let groups: GalleryGroup[];
    if (hasMdlCast) {
        groups = mdlSections;
    } else {
        const tmdbCast = (media.type === "TV" && media.source !== "MDL" ? await mediaService.getSeasonCast(media.externalId, selectedSeason) : null) ?? media.cast ?? [];
        groups = [
            {
                people: tmdbCast.map((a) => ({
                    key: String(a.id),
                    name: a.name,
                    character: a.character,
                    image: a.profile,
                    // An MDL entry's flat cast numbers its actors 0, 1, 2… — not TMDB ids.
                    href: media.source === "MDL" ? null : tmdbPersonHref(a.id),
                })),
            },
        ];
    }

    const backHref = selectedSeason > 1 ? `/media/${id}?season=${selectedSeason}` : `/media/${id}`;

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-6 m-auto px-4 md:px-6">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={backHref} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {media.title}
                    </Link>

                    <div>
                        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-fg">Cast & Credits</h1>
                        <div className="flex items-center gap-2 text-fg-muted">
                            <span className="font-medium text-fg">{media.title}</span>
                            <span>•</span>
                            <span>{media.year}</span>
                            {selectedSeason > 1 && (
                                <>
                                    <span>•</span>
                                    <span>Season {selectedSeason}</span>
                                </>
                            )}
                            <span>•</span>
                            <span>{hasMdlCast ? "MyDramaList" : "TMDB"}</span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-line-strong to-transparent" />

                <CastGallery groups={groups} />
            </div>
        </div>
    );
}
