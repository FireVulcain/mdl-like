"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";
import { settingsInput, settingsLink } from "@/components/settings/settings-ui";
import {
    excludeRadarActor,
    pinRadarActor,
    restoreRadarActor,
    searchRadarPeople,
    unpinRadarActor,
    type ActorRadarPerson,
} from "@/actions/actor-radar";

type SearchResult = { slug: string; name: string; profileImage: string | null; nationality: string };

function Avatar({ person, size = 32 }: { person: { name: string; profileImage: string | null }; size?: number }) {
    return person.profileImage ? (
        <Image
            unoptimized
            src={person.profileImage}
            alt={person.name}
            width={size}
            height={size}
            className="rounded-full object-cover shrink-0"
            style={{ width: size, height: size }}
        />
    ) : (
        <span className="flex items-center justify-center rounded-full bg-surface-4 shrink-0" style={{ width: size, height: size }}>
            <UserRound className="h-4 w-4 text-fg-muted" />
        </span>
    );
}

// Management panel for the home "From Actors You Watch" radar: add/pin actors,
// remove or restore them. Rendered on the /settings page.
export function ActorRadarManagePanel({
    scannedActors,
    excludedActors,
}: {
    scannedActors: ActorRadarPerson[];
    excludedActors: ActorRadarPerson[];
}) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const searchSeq = useRef(0);

    // Debounced people search
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setResults([]);
            setSearching(false);
            return;
        }
        setSearching(true);
        const seq = ++searchSeq.current;
        const timer = setTimeout(async () => {
            try {
                const found = await searchRadarPeople(q);
                if (searchSeq.current === seq) setResults(found);
            } catch {
                if (searchSeq.current === seq) setResults([]);
            } finally {
                if (searchSeq.current === seq) setSearching(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [query]);

    const run = (fn: () => Promise<unknown>, successMsg: string) => {
        startTransition(async () => {
            try {
                await fn();
                // Typed, not plain: the toast's edge now carries the state, and
                // an untyped one would report a success in the neutral hue.
                toast.success(successMsg);
                router.refresh();
            } catch (error) {
                console.error("Radar action failed:", error);
                toast.error("Something went wrong");
            }
        });
    };

    const scannedSlugs = new Set(scannedActors.map((a) => a.slug));

    return (
        <div className="grid max-w-lg gap-4">
            {/* Add actor */}
            <div>
                <div className="relative max-w-sm">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Add an actor…"
                        aria-label="Search an actor to add"
                        className={`${settingsInput} pr-8`}
                    />
                    {searching && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-dim" />}
                </div>
                {results.length > 0 && (
                    <div className="mt-1 max-h-56 max-w-sm divide-y divide-line-soft overflow-y-auto rounded-md bg-surface-2">
                        {results.map((person) => {
                            const alreadyIn = scannedSlugs.has(person.slug);
                            return (
                                <div key={person.slug} className="flex items-center gap-3 px-3 py-2">
                                    <Avatar person={person} size={28} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[13px] text-fg-soft">{person.name}</p>
                                        <p className="text-[11px] text-fg-dim">{person.nationality}</p>
                                    </div>
                                    {alreadyIn ? (
                                        <span className="shrink-0 text-xs text-fg-dim">On the radar</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                run(
                                                    () => pinRadarActor(person.slug, person.name, person.profileImage),
                                                    `${person.name} added to your radar`,
                                                )
                                            }
                                            disabled={isPending}
                                            className={settingsLink}
                                        >
                                            Add
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="grid gap-1">
                <p className="text-[13px] text-fg-dim">On the radar</p>
                {scannedActors.length === 0 && <p className="py-2 text-[13px] text-fg-dim">No actors on the radar right now.</p>}
                {scannedActors.map((actor) => (
                    <div key={actor.slug} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2">
                        <Avatar person={actor} size={28} />
                        <span className="flex min-w-0 flex-1 items-baseline gap-2 text-sm text-fg-soft">
                            <span className="truncate">{actor.name}</span>
                            {actor.pinned && <span className="shrink-0 text-xs text-fg-dim">pinned</span>}
                        </span>
                        <button
                            type="button"
                            onClick={() =>
                                actor.pinned
                                    ? run(() => unpinRadarActor(actor.slug), `${actor.name} removed from your radar`)
                                    : run(
                                          () => excludeRadarActor(actor.slug, actor.name, actor.profileImage),
                                          `${actor.name} removed from your radar`,
                                      )
                            }
                            disabled={isPending}
                            className={settingsLink}
                        >
                            Remove
                        </button>
                    </div>
                ))}
            </div>

            {excludedActors.length > 0 && (
                <div className="grid gap-1">
                    <p className="text-[13px] text-fg-dim">Removed</p>
                    {excludedActors.map((actor) => (
                        <div key={actor.slug} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1.5 opacity-70 transition hover:bg-surface-2 hover:opacity-100">
                            <Avatar person={actor} size={28} />
                            <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">{actor.name}</span>
                            <button
                                type="button"
                                onClick={() => run(() => restoreRadarActor(actor.slug), `${actor.name} is back on your radar`)}
                                disabled={isPending}
                                className={settingsLink}
                            >
                                Restore
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
