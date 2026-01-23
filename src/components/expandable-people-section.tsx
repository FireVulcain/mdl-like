"use client";

import { useState } from "react";
import { PersonCard } from "@/components/person-card";
import { UnifiedPerson } from "@/services/media.service";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExpandablePeopleSectionProps {
    people: UnifiedPerson[];
}

// Show 6 items per row on xl screens (matches the grid)
const INITIAL_COUNT = 6;

export function ExpandablePeopleSection({ people }: ExpandablePeopleSectionProps) {
    const [expanded, setExpanded] = useState(false);

    const displayedPeople = expanded ? people : people.slice(0, INITIAL_COUNT);
    const hasMore = people.length > INITIAL_COUNT;

    return (
        <section className="space-y-4">
            <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                <Users className="h-5 w-5 text-purple-400" />
                <h2 className="text-lg font-semibold">People</h2>
                <span className="text-sm text-muted-foreground">({people.length})</span>
                <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {displayedPeople.map((person) => (
                    <PersonCard key={person.id} person={person} />
                ))}
            </div>
            {hasMore && (
                <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-foreground"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? (
                        <>
                            <ChevronUp className="h-4 w-4 mr-2" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="h-4 w-4 mr-2" />
                            Show {people.length - INITIAL_COUNT} more people
                        </>
                    )}
                </Button>
            )}
        </section>
    );
}
