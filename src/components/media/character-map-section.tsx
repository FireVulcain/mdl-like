import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { portrait, type CharacterMapData } from "@/lib/character-map";
import { closestRelations } from "@/lib/character-map-store";
import type { ReactNode } from "react";
import { SectionHeader, SectionLink } from "./section-header";

/**
 * The "Relationships" section of a media page: who is who around the leads,
 * as a short row of chips, and the way to the full chart. The chart itself
 * lives on /media/[id]/relationships — it is read, not scanned, and this page
 * is scanned.
 *
 * Nothing is generated here: no chart, no section and no nav entry.
 */
export function CharacterMapSection({
    map,
    href,
    completed = false,
    admin,
}: {
    map: CharacterMapData;
    href: string;
    completed?: boolean;
    /** the admin's generate button, rendered beside the link when there is one */
    admin?: ReactNode;
}) {
    // Reveals only for a show the reader has finished — a twist in this row is read before the show is
    const closest = closestRelations(map, !completed);
    const rest = map.compact.people.length - (map.compact.center ?? map.main.slice(0, 2)).length - closest.length;

    return (
        <div className="space-y-4">
            <SectionHeader
                title="Relationships"
                count={map.people.length}
                className=""
                right={
                    <>
                        {admin}
                        <SectionLink href={href}>Open the map →</SectionLink>
                    </>
                }
            />

            {/* One chip per person: portrait, name, and what they are to which lead.
                The same words the chart writes under each face. */}
            <div className="flex flex-wrap gap-2">
                {closest.map(({ person, lead, link }) => (
                    <Link
                        key={person.id}
                        href={href}
                        className="group inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 transition-colors hover:bg-surface-3"
                    >
                        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-surface-3">
                            {portrait(person) ? (
                                <Image unoptimized src={portrait(person)!} alt="" fill sizes="28px" className="object-cover" />
                            ) : (
                                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                                    <User className="h-3.5 w-3.5" />
                                </span>
                            )}
                        </span>
                        <span className="text-sm text-fg">{person.name.split(" / ")[0]}</span>
                        <span className="text-xs text-fg-dim">
                            {link.short}
                            <span className="text-fg-faint"> · {lead.name.split(" / ")[0]}</span>
                        </span>
                    </Link>
                ))}
                {rest > 0 && (
                    <Link href={href} className="inline-flex items-center rounded-full px-3 py-1 text-xs text-fg-dim transition-colors hover:text-fg">
                        +{rest} more on the map
                    </Link>
                )}
            </div>
        </div>
    );
}
