import { SearchMediaGrid } from "@/components/search-media-grid";
import { ExpandablePeopleSection } from "@/components/expandable-people-section";
import { mediaService } from "@/services/media.service";
import { Search } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
    const { q } = await searchParams;
    return { title: q ? `${q} — search` : "Search" };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q: query } = await searchParams;

    // md: only, like every other page. Unqualified, it took a fifth of a phone
    // screen away from results that were already narrow.
    const shell = "container py-8 px-4 m-auto md:max-w-[80%]";

    if (!query) {
        return (
            <div className={shell}>
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <Search className="h-8 w-8 text-white/30" />
                    </div>
                    <p className="text-lg font-semibold text-white/60">Search dramas, movies and people</p>
                    <p className="text-sm text-white/30 mt-1">Use the field above, or press Ctrl K from anywhere.</p>
                </div>
            </div>
        );
    }

    const { media, people, totalPages } = await mediaService.search(query);
    const hasResults = media.length > 0 || people.length > 0;

    const found = [
        media.length > 0 ? `${media.length} title${media.length !== 1 ? "s" : ""}` : null,
        people.length > 0 ? `${people.length} ${people.length !== 1 ? "people" : "person"}` : null,
    ].filter(Boolean);

    return (
        <div className={`${shell} space-y-8`}>
            <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-white">
                    Results for &ldquo;{query}&rdquo;
                </h1>
                {found.length > 0 && <p className="text-gray-500 mt-1">{found.join(" · ")}</p>}
            </div>

            {!hasResults ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-sm font-medium text-white/40">Nothing matches &ldquo;{query}&rdquo;</p>
                    <p className="text-xs text-white/25 mt-1">Try fewer words, or the original title.</p>
                </div>
            ) : (
                <>
                    {people.length > 0 && <ExpandablePeopleSection people={people} />}

                    {media.length > 0 && (
                        <section className="space-y-4">
                            {/* The same header the filmography and media sections
                                use: name, count, hairline. It carried an accent
                                bar and an icon that said nothing the word
                                "Movies & Series" did not. */}
                            <div className="flex items-center gap-3">
                                <h2 className="font-display text-lg font-semibold text-white">Movies &amp; Series</h2>
                                <span className="text-sm text-gray-400">({media.length})</span>
                                <div className="flex-1 h-px bg-white/8" />
                            </div>
                            <SearchMediaGrid key={query} media={media} query={query} totalPages={totalPages} />
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
