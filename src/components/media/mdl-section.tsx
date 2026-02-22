import { getMdlData } from "@/lib/mdl-data";
import { MdlCastScroll } from "./mdl-cast-scroll";
import { CastScroll } from "./cast-scroll";

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
}

// Async server component — streams in MDL tags + cast.
// The Suspense fallback (TMDB cast) shows immediately; this swaps in when Kuryana responds.
export async function MdlSection({ externalId, title, year, nativeTitle, tmdbCast, mediaId }: Props) {
    const data = await getMdlData(externalId, title, year, nativeTitle);

    return (
        <>
            {data?.tags && data.tags.length > 0 && (
                <div>
                    <h3 className="text-lg font-semibold mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                        {data.tags.map((tag) => (
                            <span
                                key={tag}
                                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-sm text-white/60 hover:text-white/90 hover:border-white/20 transition-colors"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {data?.cast ? (
                <MdlCastScroll cast={data.cast} tmdbCast={tmdbCast} />
            ) : (
                <CastScroll cast={tmdbCast} mediaId={mediaId} />
            )}
        </>
    );
}
