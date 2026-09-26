import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { defaultCenter, portrait, type CharacterMapData, type MapPerson } from "@/lib/character-map";
import { closestRelations } from "@/lib/character-map-store";
import type { ReactNode } from "react";
import { SectionHeader, SectionLink } from "./section-header";

function Face({ person, size }: { person: MapPerson; size: number }) {
    const src = portrait(person);
    return (
        <span className="relative shrink-0 overflow-hidden rounded-full bg-surface-3" style={{ width: size, height: size }}>
            {src ? (
                <Image unoptimized src={src} alt="" fill sizes={`${size}px`} className="object-cover object-[50%_22%]" />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                    <User className="h-3.5 w-3.5" />
                </span>
            )}
        </span>
    );
}

/**
 * The "Relationships" section of a media page: who is who around the leads,
 * and the way to the full chart. The chart itself lives on
 * /media/[id]/relationships — it is read, not scanned, and this page is scanned.
 *
 * One box per lead, the people around them listed inside. The row of chips it
 * replaces mixed every lead's circle together and named the lead again on
 * nearly every chip; grouped, the box names them once and the structure of the
 * chart shows before it is opened.
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
    const rest = map.compact.people.length - (map.compact.center ?? defaultCenter(map.main)).length - closest.length;

    // In the order the leads first come up, which is the order of their closest tie.
    const groups: { lead: MapPerson; items: typeof closest }[] = [];
    for (const entry of closest) {
        const group = groups.find((g) => g.lead.id === entry.lead.id);
        if (group) group.items.push(entry);
        else groups.push({ lead: entry.lead, items: [entry] });
    }

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

            <div className={`grid gap-3 ${groups.length === 2 ? "md:grid-cols-2" : groups.length > 2 ? "md:grid-cols-2 xl:grid-cols-3" : ""}`}>
                {groups.map(({ lead, items }) => (
                    <div key={lead.id} className="rounded-lg bg-box p-3.5">
                        <div className="flex items-center gap-2.5 border-b border-line-soft pb-2.5 mb-1.5">
                            <Face person={lead} size={36} />
                            <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-fg">{lead.name.split(" / ")[0]}</p>
                                <p className="text-xs text-fg-dim">Main role</p>
                            </div>
                        </div>
                        {/* The same words the chart writes under each face. */}
                        <div className={`grid gap-x-3 ${groups.length === 1 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                            {items.map(({ person, link }) => (
                                <Link
                                    key={person.id}
                                    href={href}
                                    className="-mx-1.5 flex min-w-0 items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-surface-2"
                                >
                                    <Face person={person} size={32} />
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] font-medium text-fg">{person.name.split(" / ")[0]}</span>
                                        <span className="block truncate text-xs text-fg-muted">{link.short}</span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {rest > 0 && (
                <Link href={href} className="inline-block text-[13px] text-fg-dim transition-colors hover:text-fg">
                    +{rest} more on the map
                </Link>
            )}
        </div>
    );
}
