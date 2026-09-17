import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";
import { getCachedCoStars } from "@/lib/person-costars";
import { getFrequentPairs, getFrequentPeople, type SuggestedPerson } from "@/lib/together-suggestions";

function Face({ src, name, className = "h-16 w-16" }: { src: string | null; name: string; className?: string }) {
    return (
        <span className={`relative block ${className} shrink-0 overflow-hidden rounded-full bg-surface-3 ring-2 ring-line-soft transition-[box-shadow,transform] group-hover:ring-sky-400/60 group-hover:scale-105`}>
            {src ? (
                <Image unoptimized src={src} alt={name} fill sizes="64px" className="object-cover" />
            ) : (
                <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                    <User className="h-6 w-6" />
                </span>
            )}
        </span>
    );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="flex items-center gap-3">
            <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
            {hint && <span className="text-sm text-fg-dim">{hint}</span>}
            <div className="h-px flex-1 bg-surface-3" />
        </div>
    );
}

function PeopleGrid({ people, hrefFor, subtitle }: { people: SuggestedPerson[]; hrefFor: (p: SuggestedPerson) => string; subtitle: (p: SuggestedPerson) => string }) {
    return (
        <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
            {people.map((p) => (
                <li key={p.slug}>
                    <Link href={hrefFor(p)} className="group flex flex-col items-center gap-2 text-center">
                        <Face src={p.image} name={p.name} />
                        <span className="min-w-0 max-w-full">
                            <span className="block truncate text-sm text-fg-soft transition-colors group-hover:text-fg">{p.name}</span>
                            <span className="block truncate text-xs text-fg-dim">{subtitle(p)}</span>
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/**
 * What the page shows before it has anything to compare.
 *
 * Two slots and a search box are a form, not a page; nothing on them says
 * what a good answer looks like. These do. With one person picked, the faces
 * are people who share a title with them — each a comparison one click away.
 * With nobody picked, the pairs are ones already known to share more than one
 * of the viewer's shows, and the people are the ones who recur in them.
 *
 * All of it comes from the cast cache, so it is a sample of what this app has
 * seen, never a ranking of anyone's career — the headings say "your shows"
 * and "titles you know", not "most" or "best".
 */
export async function TogetherSuggestions({ a }: { a: { slug: string; name: string } | null }) {
    if (a) {
        const coStars = await getCachedCoStars(a.slug, 12).catch(() => []);
        if (coStars.length === 0) return null;
        return (
            <section className="space-y-4">
                <SectionHeading title={`People who share a title with ${a.name}`} hint="from titles you know" />
                <PeopleGrid
                    people={coStars.map((c) => ({ ...c, shows: c.shared }))}
                    hrefFor={(p) => `/people/together?a=${encodeURIComponent(a.slug)}&b=${encodeURIComponent(p.slug)}`}
                    subtitle={(p) => `${p.shows} title${p.shows === 1 ? "" : "s"}`}
                />
            </section>
        );
    }

    const [pairs, people] = await Promise.all([getFrequentPairs(6).catch(() => []), getFrequentPeople(12).catch(() => [])]);
    if (pairs.length === 0 && people.length === 0) return null;

    return (
        <div className="space-y-10">
            {pairs.length > 0 && (
                <section className="space-y-4">
                    <SectionHeading title="Pairs from your shows" hint="seen together more than once" />
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {pairs.map((pair) => (
                            <li key={`${pair.a.slug}|${pair.b.slug}`}>
                                <Link
                                    href={`/people/together?a=${encodeURIComponent(pair.a.slug)}&b=${encodeURIComponent(pair.b.slug)}`}
                                    className="group flex items-center gap-3 rounded-xl border border-line-soft bg-surface-1 p-3 transition-colors hover:bg-surface-2"
                                >
                                    <span className="flex shrink-0 -space-x-3">
                                        <Face src={pair.a.image} name={pair.a.name} className="h-12 w-12 ring-page" />
                                        <Face src={pair.b.image} name={pair.b.name} className="h-12 w-12 ring-page" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        {/* Two names rarely fit one line; wrapping beats
                                            cutting the second one off. */}
                                        <span className="block text-sm leading-snug text-fg line-clamp-2">
                                            {pair.a.name} <span className="text-fg-faint">&amp;</span> {pair.b.name}
                                        </span>
                                        <span className="block text-xs text-fg-dim">
                                            {pair.shared} of your titles
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {people.length > 0 && (
                <section className="space-y-4">
                    <SectionHeading title="Start with someone from your shows" />
                    <PeopleGrid
                        people={people}
                        hrefFor={(p) => `/people/together?a=${encodeURIComponent(p.slug)}`}
                        subtitle={(p) => `${p.shows} of your titles`}
                    />
                </section>
            )}
        </div>
    );
}
