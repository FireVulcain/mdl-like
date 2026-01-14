import { Badge } from "@/components/ui/badge";
import { ProgressTracker } from "@/components/progress-tracker";
import { mediaService } from "@/services/media.service";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUserMedia } from "@/actions/user-media";
import { updateProgress } from "@/actions/media";
import { AddToListButton } from "@/components/add-to-list-button";
import { MediaCard } from "@/components/media-card";
import { SeasonSelector } from "@/components/season-selector";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

// Mock User ID
const MOCK_USER_ID = "mock-user-1";

export default async function MediaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ season?: string }> }) {
    const { id } = await params;
    const { season } = await searchParams;
    const media = await mediaService.getDetails(id);

    if (!media) {
        notFound();
    }

    // Determine current season logic
    const selectedSeason = season ? parseInt(season) : 1;

    // Find metadata for this season (if available)
    const currentSeasonData = media.seasons?.find((s) => s.seasonNumber === selectedSeason);
    const episodeCount = currentSeasonData?.episodeCount || (selectedSeason === 1 ? media.totalEp : null) || null; // Fallback for movies or missing season data

    // Fetch user media specifically for this season
    const userMedia = await getUserMedia(MOCK_USER_ID, media.externalId, media.source, selectedSeason);

    // Determine update action if userMedia exists
    const updateAction = userMedia ? updateProgress.bind(null, userMedia.id) : undefined;

    return (
        <div>
            {/* Backdrop */}
            <div className="relative h-[40vh] w-full overflow-hidden">
                {media.backdrop ? (
                    <>
                        <Image src={media.backdrop} alt={media.title} fill className="object-cover" priority />
                        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
                    </>
                ) : (
                    <div className="h-full w-full bg-secondary" />
                )}
            </div>

            <div className="container relative -top-20 z-10 grid gap-8 md:grid-cols-[300px_1fr] m-auto">
                {/* Poster & Actions */}
                <div className="space-y-4">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-lg shadow-xl ring-4 ring-background">
                        {media.poster ? (
                            <Image src={media.poster} alt={media.title} fill className="object-cover" priority />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-muted text-muted-foreground">No Poster</div>
                        )}
                    </div>

                    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4 text-base">
                        <div className="grid grid-cols-[100px_1fr] gap-2">
                            <span className="text-muted-foreground font-medium">Title:</span>
                            <span>{media.title}</span>

                            <span className="text-muted-foreground font-medium">Type:</span>
                            <span>{media.type === "TV" ? "TV Show" : "Movie"}</span>

                            <span className="text-muted-foreground font-medium">Country:</span>
                            <span className="flex items-center gap-2">
                                {media.originCountry}{" "}
                                <Badge variant="secondary" className="text-[10px] h-5">
                                    {media.originCountry}
                                </Badge>
                            </span>

                            {media.totalEp && (
                                <>
                                    <span className="text-muted-foreground font-medium">Episodes:</span>
                                    <span>{media.totalEp}</span>
                                </>
                            )}

                            {media.aired && (
                                <>
                                    <span className="text-muted-foreground font-medium">Aired:</span>
                                    <span>{media.aired}</span>
                                </>
                            )}

                            {media.network && (
                                <>
                                    <span className="text-muted-foreground font-medium">Network:</span>
                                    <span>{media.network}</span>
                                </>
                            )}

                            {media.duration && (
                                <>
                                    <span className="text-muted-foreground font-medium">Duration:</span>
                                    <span>{media.duration}</span>
                                </>
                            )}

                            {media.contentRating && (
                                <>
                                    <span className="text-muted-foreground font-medium">Rating:</span>
                                    <Badge variant="outline">{media.contentRating}</Badge>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="rounded-lg border bg-card p-4 shadow-sm space-y-4">
                        <h3 className="font-semibold">Track Progress</h3>

                        {/* Season Selector (Only if TV and has seasons) */}
                        {media.type === "TV" && media.seasons && media.seasons.length > 0 && (
                            <div className="mb-2">
                                <SeasonSelector seasons={media.seasons} selectedSeason={selectedSeason} />
                            </div>
                        )}

                        <AddToListButton media={media} userMedia={userMedia} season={selectedSeason} totalEp={episodeCount} />

                        <div className="pt-2">
                            <div className="text-base font-medium mb-2">Episodes</div>
                            {userMedia ? (
                                <ProgressTracker
                                    current={userMedia.progress}
                                    total={episodeCount}
                                    status={userMedia.status}
                                    onUpdate={updateAction}
                                />
                            ) : (
                                <div className="text-base text-muted-foreground">Add to list to track progress</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Info */}
                <div className="pt-20 md:pt-0 space-y-8 min-w-0">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{media.title}</h1>
                        <div className="flex flex-wrap gap-2 text-muted-foreground items-center">
                            <span>{media.year}</span>
                            <span>•</span>
                            <Badge variant="outline">{media.originCountry}</Badge>
                            <span>•</span>
                            <span>{media.type}</span>
                            {media.rating > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="text-yellow-500 font-medium">★ {media.rating.toFixed(1)}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="prose prose-invert max-w-none">
                        <h3 className="text-lg font-semibold mb-2">Synopsis</h3>
                        <p className="leading-relaxed text-muted-foreground">{media.synopsis}</p>
                    </div>

                    {/* Cast & Credits */}
                    {media.cast && media.cast.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Cast & Credits</h3>
                                <Link href={`/media/${media.id}/cast`} className="text-base text-primary hover:underline font-medium">
                                    View all
                                </Link>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                {media.cast.slice(0, 6).map((actor) => (
                                    <div key={actor.id} className="flex-none w-[100px] space-y-2">
                                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-muted">
                                            {actor.profile ? (
                                                <Image src={actor.profile} alt={actor.name} fill className="object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                                                    No Image
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-base font-medium truncate" title={actor.name}>
                                                {actor.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate" title={actor.character}>
                                                {actor.character}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Photos */}
                    {media.images?.backdrops && media.images.backdrops.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Photos</h3>
                                <Link href={`/media/${media.id}/photos`} className="text-base text-primary hover:underline font-medium">
                                    View all
                                </Link>
                            </div>

                            <ScrollArea className="w-full whitespace-nowrap rounded-md">
                                <div className="flex w-max space-x-4 pb-4">
                                    {media.images.backdrops.slice(0, 6).map((src, index) => (
                                        <div key={index} className="w-[200px] sm:w-[280px]">
                                            <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                                                <Image src={src} alt={`Photo ${index + 1}`} fill className="object-cover" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </div>
                    )}

                    {/* Recommendations */}
                    {media.recommendations && media.recommendations.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                            <div className="grid grid-cols-6 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-6 gap-6">
                                {media.recommendations.map((item) => (
                                    <MediaCard key={item.id} media={item} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
