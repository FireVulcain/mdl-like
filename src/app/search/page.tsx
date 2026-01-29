import { MediaCard } from "@/components/media-card";
import { ExpandablePeopleSection } from "@/components/expandable-people-section";
import { mediaService } from "@/services/media.service";
import { Film } from "lucide-react";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
    const { q: query } = await searchParams;

    if (!query) {
        return (
            <div className="container py-8 space-y-6 m-auto max-w-[80%]">
                <p className="text-muted-foreground">Start typing to search...</p>
            </div>
        );
    }

    const { media, people } = await mediaService.search(query);
    const hasResults = media.length > 0 || people.length > 0;

    return (
        <div className="container py-8 space-y-8 m-auto max-w-[80%]">
            <h1 className="text-2xl font-bold">Results for &ldquo;{query}&rdquo;</h1>

            {!hasResults ? (
                <p className="text-muted-foreground">No results found.</p>
            ) : (
                <>
                    {/* People Section */}
                    {people.length > 0 && <ExpandablePeopleSection people={people} />}

                    {/* Media Section */}
                    {media.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-400 rounded-full" />
                                <Film className="h-5 w-5 text-blue-400" />
                                <h2 className="text-lg font-semibold">Movies & Series</h2>
                                <span className="text-sm text-muted-foreground">({media.length})</span>
                                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                {media.map((item) => (
                                    <MediaCard key={item.id} media={item} />
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
