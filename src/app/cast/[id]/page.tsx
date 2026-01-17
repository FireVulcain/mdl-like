"use client";

import { TMDB_CONFIG } from "@/lib/tmdb";
import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Star, Film, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TMDBPerson, TMDBPersonCredits } from "@/lib/tmdb";
import { getPersonData } from "@/actions/person";

function getGenderLabel(gender: number): string {
    switch (gender) {
        case 1:
            return "Female";
        case 2:
            return "Male";
        case 3:
            return "Non-binary";
        default:
            return "Not specified";
    }
}

function formatDate(dateString: string | null): string {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function calculateAge(birthday: string | null, deathday: string | null): number | null {
    if (!birthday) return null;
    const birthDate = new Date(birthday);
    const endDate = deathday ? new Date(deathday) : new Date();
    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

export default function CastProfilePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [person, setPerson] = useState<TMDBPerson | null>(null);
    const [credits, setCredits] = useState<TMDBPersonCredits | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const data = await getPersonData(id);
                setPerson(data.person);
                setCredits(data.credits);
                if (!data.person) {
                    setError(true);
                }
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-black">
                <div className="container py-8 m-auto">
                    <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                        {/* Loading skeleton for profile */}
                        <div className="space-y-4">
                            <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                            <div className="h-64 rounded-xl bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                        </div>
                        <div className="space-y-4">
                            <div className="h-12 w-64 rounded bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                            <div className="h-6 w-32 rounded bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                            <div className="h-48 rounded bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !person) {
        return (
            <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-black flex items-center justify-center">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Person not found</h1>
                    <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                        Go back home
                    </Link>
                </div>
            </div>
        );
    }

    const age = calculateAge(person.birthday, person.deathday);

    // Sort credits by release date descending (most recent first)
    const sortedCredits = [...(credits?.cast || [])].sort((a, b) => {
        const dateA = a.release_date || a.first_air_date || "";
        const dateB = b.release_date || b.first_air_date || "";
        return dateB.localeCompare(dateA);
    });

    // TMDB TV genre IDs for reality/variety content
    const realityGenreIds = [10764, 10767, 10763]; // Reality, Talk, News

    // Separate movies, series (scripted TV), and TV shows (reality/variety)
    const movies = sortedCredits.filter((c) => c.media_type === "movie");
    const tvShows = sortedCredits.filter((c) => c.media_type === "tv" && c.genre_ids?.some((id) => realityGenreIds.includes(id)));
    const series = sortedCredits.filter((c) => c.media_type === "tv" && !c.genre_ids?.some((id) => realityGenreIds.includes(id)));

    return (
        <div className="min-h-screen bg-linear-to-b from-gray-900 via-gray-900 to-black">
            <div className="container py-8 space-y-8 m-auto">
                {/* Header */}
                <div className="space-y-4">
                    <Link href="/" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </div>

                {/* Profile Section */}
                <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                    {/* Profile Image */}
                    <div className="space-y-4">
                        <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/10 hover:ring-white/20 transition-all bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer">
                            {person.profile_path ? (
                                <Image
                                    src={TMDB_CONFIG.w500Image(person.profile_path)}
                                    alt={person.name}
                                    fill
                                    className="object-cover opacity-0 transition-opacity duration-700 ease-out"
                                    priority
                                    onLoad={(e) => {
                                        const img = e.currentTarget;
                                        const container = img.parentElement;
                                        setTimeout(() => {
                                            img.classList.replace("opacity-0", "opacity-100");
                                            container?.classList.remove(
                                                "animate-shimmer",
                                                "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                                "bg-size-[200%_100%]",
                                            );
                                        }, 100);
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-linear-to-br from-gray-800 to-gray-900">
                                    No Image
                                </div>
                            )}
                        </div>

                        {/* Personal Info Card */}
                        <div
                            className="relative overflow-hidden rounded-xl border border-white/10 p-6 shadow-lg space-y-3"
                            style={{
                                background: "rgba(17, 24, 39, 0.6)",
                                backdropFilter: "blur(20px)",
                                boxShadow:
                                    "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)",
                            }}
                        >
                            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                            <h3 className="font-semibold text-lg text-white mb-4">Personal Info</h3>

                            <div className="space-y-4">
                                <div>
                                    <span className="text-gray-400 text-sm font-medium block mb-1">Known For</span>
                                    <span className="text-white">{person.known_for_department}</span>
                                </div>

                                <div>
                                    <span className="text-gray-400 text-sm font-medium block mb-1">Gender</span>
                                    <span className="text-white">{getGenderLabel(person.gender)}</span>
                                </div>

                                {person.birthday && (
                                    <div>
                                        <span className="text-gray-400 text-sm font-medium block mb-1">Birthday</span>
                                        <span className="text-white">
                                            {formatDate(person.birthday)}
                                            {age !== null && !person.deathday && ` (${age})`}
                                        </span>
                                    </div>
                                )}

                                {person.deathday && (
                                    <div>
                                        <span className="text-gray-400 text-sm font-medium block mb-1">Died</span>
                                        <span className="text-white">
                                            {formatDate(person.deathday)}
                                            {age !== null && ` (${age})`}
                                        </span>
                                    </div>
                                )}

                                {person.place_of_birth && (
                                    <div>
                                        <span className="text-gray-400 text-sm font-medium block mb-1">Place of Birth</span>
                                        <span className="text-white">{person.place_of_birth}</span>
                                    </div>
                                )}

                                {person.also_known_as && person.also_known_as.length > 0 && (
                                    <div>
                                        <span className="text-gray-400 text-sm font-medium block mb-1">Also Known As</span>
                                        <div className="flex flex-wrap gap-1">
                                            {person.also_known_as.slice(0, 5).map((name, index) => (
                                                <Badge key={index} variant="secondary" className="text-xs bg-white/10 text-gray-300 border-white/10">
                                                    {name}
                                                </Badge>
                                            ))}
                                            {person.also_known_as.length > 5 && (
                                                <Badge variant="secondary" className="text-xs bg-white/10 text-gray-400 border-white/10">
                                                    +{person.also_known_as.length - 5} more
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="space-y-8">
                        {/* Name & Title */}
                        <div>
                            <h1 className="text-4xl font-bold mb-2 text-white">{person.name}</h1>
                            <div className="flex flex-wrap gap-2 text-muted-foreground items-center">
                                <Badge variant="outline" className="bg-white/5 text-gray-300 border-white/20">
                                    {person.known_for_department}
                                </Badge>
                                {credits && (
                                    <>
                                        <span className="text-gray-500">•</span>
                                        <span className="text-gray-400">{credits.cast.length} Credits</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Biography */}
                        {person.biography && (
                            <div>
                                <h3 className="text-lg font-semibold mb-3 text-white">Biography</h3>
                                <div className="prose prose-invert max-w-none">
                                    <p className="leading-relaxed text-muted-foreground whitespace-pre-line">{person.biography}</p>
                                </div>
                            </div>
                        )}

                        <div className="h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />

                        {/* Series Section (Scripted TV) */}
                        {series.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-purple-500 to-pink-500 rounded-full" />
                                    <Tv className="h-5 w-5 text-purple-400" />
                                    <h3 className="text-lg font-semibold text-white">Series</h3>
                                    <span className="text-sm text-gray-400">({series.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {series.map((credit) => (
                                        <CreditCard key={`series-${credit.id}-${credit.character}`} credit={credit} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Movies Section */}
                        {movies.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-blue-500 to-cyan-500 rounded-full" />
                                    <Film className="h-5 w-5 text-blue-400" />
                                    <h3 className="text-lg font-semibold text-white">Movies</h3>
                                    <span className="text-sm text-gray-400">({movies.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {movies.map((credit) => (
                                        <CreditCard key={`movie-${credit.id}-${credit.character}`} credit={credit} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* TV Shows Section (Reality/Variety) */}
                        {tvShows.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-6 bg-linear-to-b from-emerald-500 to-teal-500 rounded-full" />
                                    <Tv className="h-5 w-5 text-emerald-400" />
                                    <h3 className="text-lg font-semibold text-white">TV Shows</h3>
                                    <span className="text-sm text-gray-400">({tvShows.length})</span>
                                    <div className="flex-1 h-px bg-linear-to-r from-white/10 to-transparent" />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {tvShows.map((credit) => (
                                        <CreditCard key={`tv-${credit.id}-${credit.character}`} credit={credit} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {movies.length === 0 && tvShows.length === 0 && series.length === 0 && (
                            <div className="text-center py-12 text-gray-400">No filmography information available.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface CreditCardProps {
    credit: {
        id: number;
        title?: string;
        name?: string;
        character: string;
        poster_path: string | null;
        release_date?: string;
        first_air_date?: string;
        vote_average: number;
        media_type: "movie" | "tv";
        episode_count?: number;
        origin_country?: string[];
    };
}

function CreditCard({ credit }: CreditCardProps) {
    const title = credit.title || credit.name || "Unknown";
    const year = (credit.release_date || credit.first_air_date || "").slice(0, 4);
    const mediaId = `tmdb-${credit.id}`;
    const countryCode = credit.origin_country?.[0] || "";

    return (
        <Link href={`/media/${mediaId}`} className="group block">
            <div className="space-y-2">
                <div className="relative aspect-2/3 w-full overflow-hidden rounded-lg bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))] bg-size-[200%_100%] animate-shimmer shadow-lg ring-2 ring-white/10 hover:ring-white/20 transition-all hover:scale-105">
                    {credit.poster_path ? (
                        <Image
                            src={TMDB_CONFIG.w500Image(credit.poster_path)}
                            alt={title}
                            fill
                            className="object-cover opacity-0 transition-opacity duration-700 ease-out"
                            loading="lazy"
                            onLoad={(e) => {
                                const img = e.currentTarget;
                                const container = img.parentElement;
                                setTimeout(() => {
                                    img.classList.replace("opacity-0", "opacity-100");
                                    container?.classList.remove(
                                        "animate-shimmer",
                                        "bg-[linear-gradient(to_right,rgb(31,41,55),rgb(55,65,81),rgb(31,41,55))]",
                                        "bg-size-[200%_100%]",
                                    );
                                }, 100);
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-linear-to-br from-gray-800 to-gray-900">
                            No Image
                        </div>
                    )}

                    {/* Rating Badge */}
                    {credit.vote_average > 0 && (
                        <div className="absolute left-2 top-2">
                            <Badge variant="default" className="bg-yellow-500/90 text-black hover:bg-yellow-500 text-xs">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                {credit.vote_average.toFixed(1)}
                            </Badge>
                        </div>
                    )}

                    {/* Country Badge */}
                    {countryCode && (
                        <div className="absolute right-2 top-2">
                            <Badge variant="secondary" className="bg-black/60 font-mono text-xs text-white backdrop-blur-sm">
                                {countryCode}
                            </Badge>
                        </div>
                    )}

                    {/* Episode Count for TV */}
                    {credit.episode_count && credit.episode_count > 0 && (
                        <div className="absolute right-2 bottom-2">
                            <Badge variant="secondary" className="bg-purple-500/80 text-xs text-white backdrop-blur-sm">
                                {credit.episode_count} ep
                            </Badge>
                        </div>
                    )}
                </div>

                <div>
                    <div className="font-semibold text-sm leading-tight text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {title}
                    </div>
                    {credit.character && <div className="text-xs text-gray-400 leading-tight mt-0.5 line-clamp-1">as {credit.character}</div>}
                    {year && <div className="text-xs text-gray-500 mt-0.5">{year}</div>}
                </div>
            </div>
        </Link>
    );
}
