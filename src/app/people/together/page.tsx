import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowLeft, Bookmark, Star, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mdlTitleFromLink, type KuryanaWorkItem } from "@/lib/kuryana";
import { loadPersonWorks, extractMdlId, extractFullMdlSlug, sortWorks, type PersonData } from "@/lib/person-works";
import { resolveWorkLinks, internalHref } from "@/lib/mdl-work-links";
import { getWatchlistSeasonKeys, getWatchlistPosters } from "@/actions/user-media";
import { PersonPicker, type PickedPerson } from "@/components/people/person-picker";

type Params = Promise<{ a?: string; b?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: Params }): Promise<Metadata> {
    const { a, b } = await searchParams;
    if (!a || !b) return { title: "Together" };
    const [pa, pb] = await Promise.all([loadPersonWorks(a), loadPersonWorks(b)]);
    return { title: pa && pb ? `${pa.name} & ${pb.name}` : "Together" };
}

type Credit = { work: KuryanaWorkItem; category: string };

/**
 * A person's works keyed by MDL id, one entry per title.
 *
 * MDL can file the same title under two categories for one person — an actor
 * who also produced it. The acting credit is the one with a character, so it
 * wins; the crew credit only stands when there is nothing else.
 */
function creditsById(data: PersonData): Map<string, Credit> {
    const map = new Map<string, Credit>();
    for (const [category, works] of Object.entries(data.works ?? {})) {
        if (!Array.isArray(works)) continue;
        for (const work of works) {
            const id = extractMdlId(work._slug);
            if (!id) continue;
            const existing = map.get(id);
            if (!existing || (!existing.work.role && work.role)) map.set(id, { work, category });
        }
    }
    return map;
}

function Avatar({ src, name }: { src: string | null; name: string }) {
    return (
        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-surface-3">
            {src ? (
                <Image unoptimized src={src} alt={name} fill sizes="28px" className="object-cover" />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                    <User className="h-3.5 w-3.5" />
                </span>
            )}
        </span>
    );
}

// One person's part in one title. A character and its billing where MDL names
// one; the category otherwise — "Director", "Producer" — since a crew credit
// has no role, and its `type` is the format, not the job.
// On a variety show MDL writes the appearance where a character would go —
// "(Ep. 21)", "(Ep. 150-151)" — and "as (Ep. 21)" is not a sentence. Those
// read as the episode instead.
const EPISODE_NOTE = /^\(?\s*ep(?:isode)?s?\.?\s*[\d\s,\-–&]+\)?$/i;

function RoleLine({ person, credit }: { person: PickedPerson; credit: Credit }) {
    const raw = credit.work.role?.name || null;
    const kind = credit.work.role?.type ?? credit.category;
    const episode = raw && EPISODE_NOTE.test(raw) ? raw.replace(/^\(|\)$/g, "").trim() : null;
    const character = episode ? null : raw;
    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <Avatar src={person.image} name={person.name} />
            <div className="min-w-0">
                <p className="truncate text-xs text-fg-dim">{person.name}</p>
                <p className="truncate text-sm text-fg">
                    {character ? (
                        <>
                            <span className="text-fg-muted">as </span>
                            {character}
                        </>
                    ) : episode ? (
                        <>
                            {kind}
                            <span className="text-fg-muted"> · {episode}</span>
                        </>
                    ) : (
                        kind
                    )}
                    {character && kind && <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">{kind}</span>}
                </p>
            </div>
        </div>
    );
}

export default async function TogetherPage({ searchParams }: { searchParams: Params }) {
    const { a, b } = await searchParams;
    const sameSlug = !!a && a === b;

    const [dataA, dataB] = await Promise.all([a ? loadPersonWorks(a) : null, b && !sameSlug ? loadPersonWorks(b) : null]);
    const personA: PickedPerson | null = a && dataA ? { slug: a, name: dataA.name, image: dataA.profile || null } : null;
    const personB: PickedPerson | null = b && dataB ? { slug: b, name: dataB.name, image: dataB.profile || null } : null;

    // The intersection, and everything the rows need to be drawn the way a
    // filmography draws them: our link to the title, the poster the reader
    // picked, whether it is on the list.
    let rows: { id: string; a: Credit; b: Credit }[] = [];
    let hrefFor = (id: string, work: KuryanaWorkItem): string => work.title.link;
    let posterFor = (id: string, work: KuryanaWorkItem, other: KuryanaWorkItem): string | null =>
        work.title.image ?? other.title.image ?? null;
    let ratingFor = (id: string, work: KuryanaWorkItem): number | null => (work.rating > 0 ? work.rating : null);
    let inWatchlist: (id: string) => boolean = () => false;
    let firstYear: number | null = null;

    if (dataA && dataB) {
        const byA = creditsById(dataA);
        const byB = creditsById(dataB);
        const shared = [...byA.keys()].filter((id) => byB.has(id));
        const ordered = sortWorks(shared.map((id) => byA.get(id)!.work));
        rows = ordered.map((work) => {
            const id = extractMdlId(work._slug)!;
            return { id, a: byA.get(id)!, b: byB.get(id)! };
        });

        const years = rows.map((r) => r.a.work.year).filter((y): y is number => typeof y === "number");
        firstYear = years.length > 0 ? Math.min(...years) : null;

        const [links, watchlistKeys, pickedPosters] = await Promise.all([
            resolveWorkLinks(rows.map((r) => r.id)),
            getWatchlistSeasonKeys().catch(() => [] as string[]),
            getWatchlistPosters().catch(() => []),
        ]);

        hrefFor = (id, work) => {
            const internal = internalHref(links, id);
            if (internal) return internal;
            const slug = extractFullMdlSlug(work.title.link);
            return slug ? `/media/mdl-${slug}` : work.title.link;
        };

        // Same precedence as a person page: a poster picked by hand, then
        // MDL's own image for the title from either filmography.
        const pickedBySeason = new Map(pickedPosters.map((p) => [`${p.externalId}-${p.season}`, p.poster]));
        const pickedByShow = new Map<string, string>();
        for (const p of pickedPosters) if (p.poster && !pickedByShow.has(p.externalId)) pickedByShow.set(p.externalId, p.poster);
        posterFor = (id, work, other) => {
            const tmdbId = links.mdlToTmdb.get(id);
            const season = links.mdlSeasonMap.get(id);
            const picked = tmdbId
                ? ((season != null ? pickedBySeason.get(`${tmdbId}-${season}`) : null) ??
                  pickedBySeason.get(`${tmdbId}-1`) ??
                  pickedByShow.get(tmdbId) ??
                  null)
                : null;
            return picked ?? work.title.image ?? other.title.image ?? null;
        };

        ratingFor = (id, work) => links.mdlRatingMap.get(id) ?? (work.rating > 0 ? work.rating : null);

        const trackedSeasons = new Set<string>();
        const trackedMdlIds = new Set<string>();
        for (const key of watchlistKeys) {
            const [source, externalId, season] = key.split(":");
            if (source === "MDL") trackedMdlIds.add(externalId.split("-")[0]);
            else trackedSeasons.add(`${externalId}-${season}`);
        }
        inWatchlist = (id) => {
            if (trackedMdlIds.has(id)) return true;
            const tmdbId = links.mdlToTmdb.get(id);
            if (!tmdbId) return false;
            return trackedSeasons.has(`${tmdbId}-${links.mdlSeasonMap.get(id) ?? 1}`);
        };
    }

    const bothPicked = !!(personA && personB);

    return (
        <div className="container py-8 space-y-8 m-auto px-4 md:px-6 max-w-4xl">
            <Link href="/" className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300 transition-colors">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
            </Link>

            <div>
                <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Together</h1>
                <p className="mt-1 text-fg-dim">Pick two people to see every title they share, and who played what.</p>
            </div>

            {/* The two slots and an ampersand. Each picker edits only its own
                key, so the other choice survives a change of mind. */}
            <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
                <PersonPicker slot="a" selected={personA} autoFocus={!personA} />
                <span className="hidden text-center font-display text-2xl text-fg-faint md:block">&amp;</span>
                <PersonPicker slot="b" selected={personB} autoFocus={!!personA && !personB} />
            </div>

            {sameSlug && <p className="text-sm text-amber-400">That is the same person twice — pick someone else for the second slot.</p>}
            {a && !dataA && !sameSlug && <p className="text-sm text-fg-dim">Could not load the first person from MDL right now.</p>}
            {b && !dataB && !sameSlug && <p className="text-sm text-fg-dim">Could not load the second person from MDL right now.</p>}

            {bothPicked && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <h2 className="font-display text-lg font-semibold text-fg">
                            {rows.length === 0
                                ? "Nothing in common"
                                : `${rows.length} title${rows.length !== 1 ? "s" : ""} together`}
                        </h2>
                        {firstYear !== null && rows.length > 1 && <span className="text-sm text-fg-muted">since {firstYear}</span>}
                        <div className="h-px flex-1 bg-surface-3" />
                    </div>

                    {rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line-strong bg-surface-2">
                                <Users className="h-7 w-7 text-fg-faint" />
                            </div>
                            <p className="text-sm font-medium text-fg-dim">
                                {personA.name} and {personB.name} have no shared credits on MDL.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {rows.map(({ id, a: ca, b: cb }) => {
                                const work = ca.work;
                                const title = work.title.name || mdlTitleFromLink(work.title.link);
                                const year = typeof work.year === "number" ? work.year : "TBA";
                                const href = hrefFor(id, work);
                                const external = href.startsWith("http");
                                const poster = posterFor(id, work, cb.work);
                                const rating = ratingFor(id, work);
                                const tracked = inWatchlist(id);
                                const category = work.type ?? ca.category;
                                const meta = [category, year, work.episodes && work.episodes > 0 ? `${work.episodes} episode${work.episodes === 1 ? "" : "s"}` : null]
                                    .filter(Boolean)
                                    .join(" · ");
                                const TitleLink = ({ children, className }: { children: React.ReactNode; className: string }) =>
                                    external ? (
                                        <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                                            {children}
                                        </a>
                                    ) : (
                                        <Link href={href} className={className}>
                                            {children}
                                        </Link>
                                    );

                                return (
                                    <article
                                        key={id}
                                        className="group flex gap-3 rounded-xl border border-line-soft bg-surface-1 p-3 transition-colors hover:bg-surface-2 md:gap-4 md:p-4"
                                    >
                                        <TitleLink className="relative aspect-2/3 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-2 sm:w-24">
                                            {poster ? (
                                                <Image
                                                    unoptimized
                                                    src={poster}
                                                    alt={title}
                                                    fill
                                                    sizes="96px"
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <span className="absolute inset-0 flex items-center justify-center text-xs text-fg-muted">No Image</span>
                                            )}
                                            {rating !== null && (
                                                <span className="absolute left-1.5 top-1.5">
                                                    <Badge className="bg-sky-500/90 px-1.5 text-xs text-white">
                                                        <Star className="mr-0.5 h-3 w-3 fill-current" />
                                                        {rating.toFixed(1)}
                                                    </Badge>
                                                </span>
                                            )}
                                            {tracked && (
                                                <span className="absolute bottom-1.5 left-1.5">
                                                    <Badge className="bg-emerald-500/90 px-1.5 text-xs text-white backdrop-blur-sm">
                                                        <Bookmark className="h-3 w-3 fill-current" />
                                                    </Badge>
                                                </span>
                                            )}
                                        </TitleLink>

                                        <div className="min-w-0 flex-1">
                                            <TitleLink className="font-display text-base font-semibold text-sky-300 transition-colors hover:text-sky-200 md:text-lg">
                                                {title}
                                            </TitleLink>
                                            <p className="mt-0.5 text-xs text-fg-muted md:text-sm">{meta}</p>

                                            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                                                <RoleLine person={personA} credit={ca} />
                                                <RoleLine person={personB} credit={cb} />
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}

            {!bothPicked && !sameSlug && (
                <p className="text-sm text-fg-faint">
                    {personA ? `Now pick someone to compare with ${personA.name}.` : "Start with anyone — an actor, a director, a writer."}
                </p>
            )}
        </div>
    );
}
