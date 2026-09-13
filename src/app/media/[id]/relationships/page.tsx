import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { mediaService } from "@/services/media.service";
import { mediaMetadata } from "@/lib/page-metadata";
import { getDisplayPreferences } from "@/actions/preferences";
import { getCharacterMap, resolveMdlSlug } from "@/lib/character-map-store";
import { CharacterMap } from "@/components/media/character-map";

type Params = Promise<{ id: string }>;
type Search = Promise<{ season?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    return mediaMetadata((await params).id, "Relationships");
}

/**
 * The relationship chart on its own page, the way cast, photos and reviews
 * have theirs: it is read for a minute, not scanned, and at 760px it was the
 * largest thing on a page built to be scanned.
 *
 * The chart belongs to the MDL entry, so ?season= picks the entry the same
 * way the media page does. A season without a chart is a 404, not an empty
 * frame — nothing is generated on the page.
 */
export default async function RelationshipsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    const [{ id }, { season }] = await Promise.all([params, searchParams]);
    const selectedSeason = season ? parseInt(season) || 1 : 1;

    const [media, slug, displayPrefs] = await Promise.all([mediaService.getDetails(id), resolveMdlSlug(id, selectedSeason), getDisplayPreferences()]);
    if (!media) notFound();
    const map = await getCharacterMap(slug);
    if (!map) notFound();

    const back = selectedSeason > 1 ? `/media/${id}?season=${selectedSeason}` : `/media/${id}`;

    return (
        <div className="min-h-screen bg-linear-to-b">
            <div className="container py-8 space-y-6 m-auto px-4 md:px-6">
                <div className="space-y-4">
                    <Link href={back} className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to {media.title}
                    </Link>

                    <div>
                        <h1 className="font-display text-3xl font-bold tracking-tight mb-2 text-fg">Relationships</h1>
                        <div className="flex items-center gap-2 text-fg-muted">
                            <span className="font-medium text-fg">{media.title}</span>
                            {selectedSeason > 1 && <span className="text-fg-dim">S{selectedSeason}</span>}
                            <span>•</span>
                            <span>{media.year}</span>
                            <span>•</span>
                            <span>
                                {map.compact.people.length} of {map.people.length} people
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-linear-to-r from-transparent via-line-strong to-transparent" />

                <CharacterMap map={map} hideSpoilers={displayPrefs.hideSpoilers} />
            </div>
        </div>
    );
}
