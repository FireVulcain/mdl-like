"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { MdlCast } from "@/actions/mdl";
import { mdlPersonHref, tmdbPersonHref } from "@/lib/person-links";
import { SourceToggle } from "@/components/media/source-toggle";
import { SectionHeader, SectionLink } from "@/components/media/section-header";

interface TmdbActor {
    id: number;
    name: string;
    character: string;
    profile: string | null;
}

interface MdlCastScrollProps {
    cast: MdlCast;
    tmdbCast: TmdbActor[];
    mediaId: string;
}

// One shape for both sources, so the two views draw the same rows.
type Person = { key: string; name: string; character: string; image: string | null; href: string | null };

// How many supporting roles show before "Show more": two rows of four.
const SUPPORT_VISIBLE = 8;

/**
 * A main role: a wide box, photo on the left, name and character large.
 *
 * The section used to drop its leads into an eight-column grid, so a show
 * with two main roles left three quarters of the width empty, and everyone
 * else waited behind a button. The leads now take the width, and the
 * supporting cast is on the page from the start.
 */
function LeadCard({ person, compact }: { person: Person; compact: boolean }) {
    const inner = (
        <>
            <div className={`relative ${compact ? "w-18" : "w-24 sm:w-27"} aspect-3/4 shrink-0 overflow-hidden rounded-md bg-surface-3`}>
                {person.image ? (
                    <Image unoptimized src={person.image} alt={person.name} fill sizes="108px" className="object-cover" loading="lazy" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-fg-dim">No image</div>
                )}
            </div>
            <div className="flex min-w-0 flex-col justify-end gap-0.5">
                <span className={`${compact ? "text-[15px]" : "text-lg"} font-bold leading-tight tracking-tight text-fg`}>{person.name}</span>
                {person.character && <span className={`${compact ? "text-[13px]" : "text-sm"} text-fg-muted line-clamp-2`}>as {person.character}</span>}
            </div>
        </>
    );
    const cls = "flex gap-4 rounded-lg bg-box p-3";
    return person.href ? (
        <Link href={person.href} className={`${cls} hover:bg-surface-3 transition-colors`}>
            {inner}
        </Link>
    ) : (
        <div className={cls}>{inner}</div>
    );
}

// A supporting role: a small portrait, name and character on two lines. Cut
// to 3:4 like the leads rather than a circle: MDL photos are tall portraits,
// and a circle kept only the middle of the face, clipping chin and hair.
function CastRow({ person }: { person: Person }) {
    const inner = (
        <>
            <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-surface-3">
                {person.image && (
                    <Image unoptimized src={person.image} alt={person.name} fill sizes="36px" className="object-cover object-top" loading="lazy" />
                )}
            </div>
            <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-fg">{person.name}</p>
                {person.character && <p className="truncate text-xs text-fg-muted">{person.character}</p>}
            </div>
        </>
    );
    const cls = "-mx-1.5 flex items-center gap-2.5 rounded-lg p-1.5";
    return person.href ? (
        <Link href={person.href} className={`${cls} hover:bg-surface-2 transition-colors`}>
            {inner}
        </Link>
    ) : (
        <div className={cls}>{inner}</div>
    );
}

const ROW_GRID = "grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1";

function RoleGroup({ label, people }: { label: string; people: Person[] }) {
    if (people.length === 0) return null;
    return (
        <div className="space-y-1.5">
            <p className="text-[13px] text-fg-dim">{label}</p>
            <div className={ROW_GRID}>
                {people.map((p) => (
                    <CastRow key={p.key} person={p} />
                ))}
            </div>
        </div>
    );
}

export function MdlCastScroll({ cast, tmdbCast, mediaId }: MdlCastScrollProps) {
    const [showAll, setShowAll] = useState(false);
    const [source, setSource] = useState<"mdl" | "tmdb">("mdl");
    const { main, support, guest, cameo } = cast;
    const totalSupport = support.length + guest.length + cameo.length;

    if (main.length === 0 && totalSupport === 0) return null;

    // MDL cast always links to the MDL person page. Routing on a TMDB name match
    // made two actors of the same show land on different routes depending on
    // whether TMDB spelled the name the same way.
    const fromMdl = (a: (typeof main)[number]): Person => ({
        key: a.slug,
        name: a.name,
        character: a.characterName,
        image: a.profileImage || null,
        href: mdlPersonHref(a.slug),
    });

    const supportPeople = support.map(fromMdl);
    const shownSupport = showAll ? supportPeople : supportPeople.slice(0, SUPPORT_VISIBLE);
    const hiddenCount = totalSupport - shownSupport.length - (showAll ? guest.length + cameo.length : 0);

    return (
        <div>
            <SectionHeader
                title="Cast"
                count={source === "tmdb" ? tmdbCast.length : main.length + totalSupport}
                right={
                    <>
                        {tmdbCast.length > 0 && <SourceToggle value={source} onChange={setSource} />}
                        <SectionLink href={`/media/${mediaId}/cast`} />
                    </>
                }
            />

            {/* TMDB has no main/supporting flag, so its cast is one list in
                billing order rather than leads and the rest. */}
            {source === "tmdb" && (
                <div className={ROW_GRID}>
                    {tmdbCast.slice(0, 12).map((a) => (
                        <CastRow
                            key={a.id}
                            person={{ key: String(a.id), name: a.name, character: a.character, image: a.profile, href: tmdbPersonHref(a.id) }}
                        />
                    ))}
                </div>
            )}

            {source === "mdl" && (
                <div className="space-y-5">
                    {main.length > 0 && (
                        // Two leads share the width in two wide boxes. Three or more
                        // would stack into a wall of half-empty boxes, so they go
                        // one row of smaller ones, four across at most.
                        <div className="space-y-1.5">
                            <p className="text-[13px] text-fg-dim">Main role</p>
                            <div
                                className={`grid gap-3 ${
                                    main.length <= 2
                                        ? "sm:grid-cols-2"
                                        : main.length === 3
                                          ? "sm:grid-cols-2 lg:grid-cols-3"
                                          : "grid-cols-2 lg:grid-cols-4"
                                }`}
                            >
                                {main.map((a) => (
                                    <LeadCard key={a.slug} person={fromMdl(a)} compact={main.length > 2} />
                                ))}
                            </div>
                        </div>
                    )}

                    <RoleGroup label="Supporting" people={shownSupport} />
                    {showAll && <RoleGroup label="Guest" people={guest.map(fromMdl)} />}
                    {showAll && <RoleGroup label="Cameo" people={cameo.map(fromMdl)} />}

                    {(hiddenCount > 0 || showAll) && (
                        <button
                            onClick={() => setShowAll((v) => !v)}
                            className="cursor-pointer flex items-center gap-1.5 text-[13px] text-fg-dim hover:text-fg transition-colors"
                        >
                            {showAll ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            {showAll
                                ? "Show less"
                                : `Show ${hiddenCount} more${guest.length + cameo.length > 0 ? ", guest and cameo included" : ""}`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
