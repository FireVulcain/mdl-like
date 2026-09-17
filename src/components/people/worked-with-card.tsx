import Link from "next/link";
import Image from "next/image";
import { ArrowRight, User, Users } from "lucide-react";
import { getCachedCoStars } from "@/lib/person-costars";

/**
 * The co-star lookup, given a place on the page.
 *
 * It used to be three words in the meta line under the name, between the work
 * count and a separator — a feature you had to already know about to see. A
 * card in the sidebar says what it does, and the faces make it concrete: each
 * is a comparison one click away, with this person already in the first slot.
 *
 * The faces come from the cache, so they are a sample, not a ranking — see
 * getCachedCoStars. The card never says "most", and the button is the point;
 * the faces are the shortcut.
 */
export async function WorkedWithCard({ slug, name }: { slug: string; name: string }) {
    const coStars = await getCachedCoStars(slug, 5).catch(() => []);
    const pairHref = (b?: string) =>
        `/people/together?a=${encodeURIComponent(slug)}${b ? `&b=${encodeURIComponent(b)}` : ""}`;

    return (
        <div
            className="relative overflow-hidden rounded-xl border border-line-strong p-5 shadow-lg space-y-4"
            style={{
                background: "var(--panel-soft)",
                backdropFilter: "blur(20px)",
                boxShadow: "var(--panel-shadow)",
            }}
        >
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-line-strong to-transparent" />

            <div className="space-y-1">
                <h3 className="font-display font-semibold text-lg text-fg flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-400" />
                    Worked with…
                </h3>
                <p className="text-sm text-fg-muted leading-relaxed">
                    Pick a second person and see every title they share with {name}.
                </p>
            </div>

            {coStars.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">From titles you know</p>
                    <ul className="space-y-1">
                        {coStars.map((c) => (
                            <li key={c.slug}>
                                <Link
                                    href={pairHref(c.slug)}
                                    className="group flex items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg hover:bg-surface-2 transition-colors"
                                >
                                    <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-surface-3 ring-1 ring-line-soft">
                                        {c.image ? (
                                            <Image unoptimized src={c.image} alt={c.name} fill sizes="32px" className="object-cover" />
                                        ) : (
                                            <span className="absolute inset-0 flex items-center justify-center text-fg-faint">
                                                <User className="h-3.5 w-3.5" />
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex-1 min-w-0 text-sm text-fg-soft group-hover:text-fg truncate transition-colors">
                                        {c.name}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-fg-faint opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Link
                href={pairHref()}
                className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-surface-3 hover:bg-surface-4 text-sm font-medium text-fg transition-colors"
            >
                {coStars.length > 0 ? "Someone else…" : "Choose a person"}
                <ArrowRight className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}
