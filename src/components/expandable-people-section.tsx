"use client";

import Link from "next/link";
import Image from "next/image";
import { UnifiedPerson } from "@/services/media.service";
import { Users } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ExpandablePeopleSectionProps {
    people: UnifiedPerson[];
}

export function ExpandablePeopleSection({ people }: ExpandablePeopleSectionProps) {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                <Users className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold">People</h2>
                <span className="text-sm text-muted-foreground">({people.length})</span>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <ScrollArea className="w-full whitespace-nowrap" viewportStyle={{ overflowY: "hidden" }}>
                <div className="flex gap-4 pt-1 pb-3">
                    {people.map((person) => (
                        <Link
                            key={person.id}
                            href={person.source === "MDL" ? `/${person.externalId}` : `/cast/${person.externalId}`}
                            className="flex-none w-28 text-center group space-y-2"
                        >
                            {" "}
                            <div className="relative w-20 h-20 mx-auto overflow-hidden rounded-full ring-2 ring-white/10 group-hover:ring-purple-500/50 transition-all shadow-lg bg-secondary">
                                {person.profileImage ? (
                                    <Image
                                        src={person.profileImage}
                                        alt={person.name}
                                        fill
                                        unoptimized={true}
                                        className="object-cover"
                                        sizes="80px"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                                )}
                            </div>
                            <div className="whitespace-normal">
                                <p className="text-sm font-medium leading-tight text-foreground group-hover:text-purple-400 transition-colors line-clamp-1">
                                    {person.name}
                                </p>
                                <Badge variant="secondary" className="mt-1 text-[10px] bg-white/10 text-gray-400 border-white/10">
                                    {person.knownForDepartment}
                                </Badge>
                            </div>
                        </Link>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </section>
    );
}
