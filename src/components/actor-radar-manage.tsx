"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Pin, Search, Settings2, UserRound, UserRoundMinus, UserRoundPlus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
        <span className="flex items-center justify-center rounded-full bg-white/10 shrink-0" style={{ width: size, height: size }}>
            <UserRound className="h-4 w-4 text-gray-400" />
        </span>
    );
}

export function ActorRadarManage({
    scannedActors,
    excludedActors,
}: {
    scannedActors: ActorRadarPerson[];
    excludedActors: ActorRadarPerson[];
}) {
    const [open, setOpen] = useState(false);
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
                toast(successMsg);
                router.refresh();
            } catch (error) {
                console.error("Radar action failed:", error);
                toast.error("Something went wrong");
            }
        });
    };

    const scannedSlugs = new Set(scannedActors.map((a) => a.slug));

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="h-8 w-8 rounded-full flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white ring-2 ring-[#0a0a0f] transition-all cursor-pointer shrink-0"
                aria-label="Manage radar actors"
                title="Manage actors"
            >
                <Settings2 className="h-4 w-4" />
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md bg-gray-900 border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-white">Radar actors</DialogTitle>
                        <DialogDescription className="text-gray-400">
                            Add actors you love, or remove ones you don&apos;t want recommendations from.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Add actor */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search an actor to add..."
                            className="w-full pl-8 pr-8 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-white/20"
                        />
                        {searching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 animate-spin" />}
                    </div>
                    {results.length > 0 && (
                        <div className="rounded-lg border border-white/10 divide-y divide-white/5 max-h-56 overflow-y-auto">
                            {results.map((person) => {
                                const alreadyIn = scannedSlugs.has(person.slug);
                                return (
                                    <div key={person.slug} className="flex items-center gap-3 px-3 py-2">
                                        <Avatar person={person} size={28} />
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-sm text-gray-200">{person.name}</p>
                                            <p className="text-[10px] text-gray-500">{person.nationality}</p>
                                        </div>
                                        {alreadyIn ? (
                                            <span className="text-[10px] text-gray-500 shrink-0">On the radar</span>
                                        ) : (
                                            <button
                                                onClick={() =>
                                                    run(
                                                        () => pinRadarActor(person.slug, person.name, person.profileImage),
                                                        `${person.name} added to your radar`,
                                                    )
                                                }
                                                disabled={isPending}
                                                className="h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs text-violet-300 hover:bg-violet-500/15 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                                            >
                                                <UserRoundPlus className="h-3.5 w-3.5" />
                                                Add
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="space-y-4 max-h-[45vh] overflow-y-auto">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">Current favorites</p>
                            {scannedActors.length === 0 && (
                                <p className="text-sm text-gray-500 px-1 py-2">No actors on the radar right now.</p>
                            )}
                            {scannedActors.map((actor) => (
                                <div key={actor.slug} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                                    <Avatar person={actor} />
                                    <span className="flex-1 min-w-0 truncate text-sm text-gray-200 flex items-center gap-1.5">
                                        {actor.name}
                                        {actor.pinned && <Pin className="h-3 w-3 text-violet-400 shrink-0" />}
                                    </span>
                                    <button
                                        onClick={() =>
                                            actor.pinned
                                                ? run(() => unpinRadarActor(actor.slug), `${actor.name} removed from your radar`)
                                                : run(
                                                      () => excludeRadarActor(actor.slug, actor.name, actor.profileImage),
                                                      `${actor.name} removed from your radar`,
                                                  )
                                        }
                                        disabled={isPending}
                                        className="h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <UserRoundMinus className="h-3.5 w-3.5" />
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>

                        {excludedActors.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">Removed</p>
                                {excludedActors.map((actor) => (
                                    <div key={actor.slug} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors opacity-70 hover:opacity-100">
                                        <Avatar person={actor} />
                                        <span className="flex-1 min-w-0 truncate text-sm text-gray-400">{actor.name}</span>
                                        <button
                                            onClick={() => run(() => restoreRadarActor(actor.slug), `${actor.name} is back on your radar`)}
                                            disabled={isPending}
                                            className="h-7 px-2 rounded-lg flex items-center gap-1.5 text-xs text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            <UserRoundPlus className="h-3.5 w-3.5" />
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
