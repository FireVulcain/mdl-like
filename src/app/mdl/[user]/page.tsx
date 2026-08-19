import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { kuryanaGetDramaList, type KuryanaDramaListSection } from "@/lib/kuryana";
import { MdlUserList, type ListSection } from "@/components/mdl-user-list";
import { PageBackground } from "@/components/page-background";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// MDL's two dramalist layouts name the same section differently — the classic
// one says "Watching", the newer one "Currently Watching". Left alone, the
// unknown spelling sorts last and the same section is titled two different
// things depending on whose list it is.
const SECTION_ALIASES: Record<string, string> = {
    "Currently Watching": "Watching",
    "On Hold": "On-hold",
};

// MDL's own order buries what someone is actually watching; this is the order
// the app's own watchlist filters use. Sorted here rather than in the list
// component: a "use client" module cannot lend a function back to the server.
const SECTION_ORDER = ["Watching", "Completed", "On-hold", "Plan to Watch", "Dropped", "Undecided"];

function sortSections(list: Record<string, KuryanaDramaListSection>): ListSection[] {
    return Object.entries(list)
        .map(([raw, section]) => {
            const label = SECTION_ALIASES[raw] ?? raw;
            return { key: label, label, section };
        })
        .sort((a, b) => {
            // Anything the scraper invents later lands after the known set
            // rather than in the middle of it, and keeps a stable order there.
            const ai = SECTION_ORDER.indexOf(a.label);
            const bi = SECTION_ORDER.indexOf(b.label);
            if (ai === -1 && bi === -1) return a.label.localeCompare(b.label);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });
}

type Params = Promise<{ user: string }>;
type Search = Promise<{ name?: string }>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: Search }): Promise<Metadata> {
    const [{ user }, { name }] = await Promise.all([params, searchParams]);
    const who = name || user;
    return { title: `${who}'s MDL list`, description: `What ${who} is watching on MyDramaList.` };
}

export default async function MdlUserPage({ params, searchParams }: { params: Params; searchParams: Search }) {
    const [{ user }, { name }] = await Promise.all([params, searchParams]);

    const result = await kuryanaGetDramaList(user);
    // Only a failed scrape is a missing page. An account whose list is private
    // answers normally with no sections at all, and telling someone the person
    // they just clicked does not exist would be wrong.
    if (!result?.data) notFound();
    const list = result.data.list ?? {};
    const isEmpty = Object.keys(list).length === 0;

    // The scrape carries no display name, so the linking page passes one along.
    // On a bare URL the identifier is all there is — which for some accounts is
    // a number, and saying "16750552's list" is better than inventing a name.
    const displayName = name?.trim() || user;
    const sections = sortSections(list);

    return (
        <div className="relative min-h-screen overflow-hidden">
            <PageBackground />

            <div className="container py-10 md:py-14 px-4 mx-auto max-w-4xl relative z-10 space-y-9">
                <header className="flex items-end justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold tracking-wide text-sky-400">MyDramaList</p>
                        <h1 className="font-display text-3xl md:text-4xl font-black tracking-tight text-white mt-1.5 wrap-break-word">
                            {displayName}
                        </h1>
                    </div>
                    {result.data.link && (
                        <a
                            href={result.data.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 inline-flex items-center gap-1.5 pb-1 text-xs text-gray-500 hover:text-white transition-colors"
                        >
                            <ExternalLink className="size-3.5" />
                            View on MDL
                        </a>
                    )}
                </header>

                {isEmpty ? (
                    // MDL serves two dramalist layouts and the scraper only reads
                    // the classic one, so an empty payload means "couldn't read
                    // it" at least as often as it means "nothing there". Claiming
                    // the list is private would be a confident guess, and wrong
                    // for every account on the newer layout.
                    <div className="py-16 text-center border-y border-white/8 space-y-3">
                        <p className="text-sm text-gray-400">This list couldn&rsquo;t be read here.</p>
                        <p className="text-xs text-gray-600 max-w-sm mx-auto">
                            It may be private, empty, or using a list layout we can&rsquo;t parse yet.
                        </p>
                        {result.data.link && (
                            <a
                                href={result.data.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                            >
                                <ExternalLink className="size-3.5" />
                                Open it on MyDramaList
                            </a>
                        )}
                    </div>
                ) : (
                    <MdlUserList sections={sections} />
                )}
            </div>
        </div>
    );
}
