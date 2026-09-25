import Image from "next/image";
import Link from "next/link";

export interface GalleryPerson {
    key: string;
    name: string;
    character: string;
    image: string | null;
    href: string | null;
}

export interface GalleryGroup {
    // Omitted for TMDB, which has no main/supporting flag: one list in billing order.
    label?: string;
    people: GalleryPerson[];
}

// A small portrait beside the name, as MDL lays out its cast page. Full-width
// 2:3 posters made two leads fill the screen.
function PersonRow({ person }: { person: GalleryPerson }) {
    const inner = (
        <>
            <div className="relative h-30 w-22.5 shrink-0 overflow-hidden rounded-md bg-surface-3">
                {person.image ? (
                    <Image unoptimized src={person.image} alt={person.name} fill sizes="90px" className="object-cover object-top" loading="lazy" />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-fg-dim">No image</div>
                )}
            </div>
            <div className="min-w-0 space-y-0.5">
                <p className="text-[15px] font-medium leading-tight text-fg line-clamp-2">{person.name}</p>
                {person.character && <p className="text-sm leading-tight text-fg-muted line-clamp-2">{person.character}</p>}
            </div>
        </>
    );
    const cls = "-mx-2 flex items-center gap-4 rounded-lg p-2";
    return person.href ? (
        <Link href={person.href} className={`${cls} hover:bg-surface-2 transition-colors`}>
            {inner}
        </Link>
    ) : (
        <div className={cls}>{inner}</div>
    );
}

export function CastGallery({ groups }: { groups: GalleryGroup[] }) {
    const filled = groups.filter((g) => g.people.length > 0);
    if (filled.length === 0) {
        return <div className="text-center py-12 text-fg-muted">No cast information available.</div>;
    }

    return (
        <div className="space-y-8">
            {filled.map((g, i) => (
                <section key={g.label ?? i} className="space-y-2">
                    {g.label && (
                        <h2 className="font-display text-lg font-semibold text-fg">
                            {g.label} <span className="text-sm font-normal tabular-nums text-fg-dim">{g.people.length}</span>
                        </h2>
                    )}
                    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1">
                        {g.people.map((p) => (
                            <PersonRow key={p.key} person={p} />
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
