"use client";

import Link from "next/link";
import Image from "next/image";
import { UnifiedPerson } from "@/services/media.service";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { mdlPersonHref, tmdbPersonHref } from "@/lib/person-links";

interface ExpandablePeopleSectionProps {
    people: UnifiedPerson[];
}

export function ExpandablePeopleSection({ people }: ExpandablePeopleSectionProps) {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-semibold text-white">People</h2>
                <span className="text-sm text-gray-400">({people.length})</span>
                <div className="flex-1 h-px bg-white/8" />
            </div>
            <ScrollArea className="w-full whitespace-nowrap" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 pt-1 pb-3">
                    {people.map((person) => (
                        <Link
                            key={person.id}
                            href={
                                person.source === "MDL"
                                    ? (mdlPersonHref(person.externalId) ?? "#")
                                    : tmdbPersonHref(person.externalId)
                            }
                            className="flex-none w-28 text-center group space-y-2"
                        >
                            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-full ring-2 ring-white/10 group-hover:ring-white/20 transition-all bg-white/5">
                                {person.profileImage ? (
                                    <Image unoptimized={true}
                                        src={person.profileImage}
                                        alt={person.name}
                                        fill className="object-cover"
                                        sizes="80px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                                )}
                            </div>
                            <div className="whitespace-normal">
                                {/* Sky is the app's link colour; purple means a
                                    recommendation and meant nothing here. */}
                                <p className="text-sm font-medium leading-tight text-white group-hover:text-sky-400 transition-colors line-clamp-1">
                                    {person.name}
                                </p>
                                {/* A filled chip framed a label that never changes
                                    state — the frame was the only thing it added. */}
                                <p className="mt-0.5 text-[11px] text-gray-500">{person.knownForDepartment}</p>
                            </div>
                        </Link>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </section>
    );
}
