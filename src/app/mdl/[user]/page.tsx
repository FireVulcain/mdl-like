import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

    // Prefer our own TMDB page for anything already linked: it carries the
    // artwork, cast, episode guide and the watchlist controls, where the
    // MDL-native page is only what the scraper could reach. Same three tables
    // and the same precedence the home sections use, so a title does not resolve
    // one way here and another way there.
    const slugs = [...new Set(Object.values(list).flatMap((s) => s.items.map((i) => i.id)))];
    const [showLinks, seasonLinks, aliasLinks] = slugs.length
        ? await Promise.all([
              prisma.cachedMdlData.findMany({
                  where: { mdlSlug: { in: slugs }, mdlDisabled: false },
                  select: { mdlSlug: true, tmdbExternalId: true },
              }),
              prisma.mdlSeasonLink.findMany({
                  where: { mdlSlug: { in: slugs } },
                  select: { mdlSlug: true, tmdbExternalId: true, season: true },
              }),
              prisma.mdlAlias.findMany({
                  where: { mdlSlug: { in: slugs } },
                  select: { mdlSlug: true, tmdbExternalId: true },
              }),
          ])
        : [[], [], []];

    const linkedBySlug = new Map<string, { tmdbExternalId: string; season?: number }>([
        ...showLinks.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
        ...seasonLinks.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId, season: r.season }] as const),
        ...aliasLinks.map((r) => [r.mdlSlug, { tmdbExternalId: r.tmdbExternalId }] as const),
    ]);

    // Resolved server-side and keyed by slug: the client only needs a href, and
    // the unlinked ones stay on the MDL-native page.
    const hrefBySlug: Record<string, string> = {};
    for (const [slug, link] of linkedBySlug) {
        hrefBySlug[slug] = `/media/tmdb-${link.tmdbExternalId}${link.season && link.season > 1 ? `?season=${link.season}` : ""}`;
    }

    return (
        <div className="relative min-h-screen overflow-hidden">
            <PageBackground />

            {/* The shell every other page uses, rather than a narrower one of
                its own: a list of titles is not a different kind of page. */}
            <div className="container py-8 px-4 m-auto md:max-w-[80%] relative z-10 space-y-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="font-display text-3xl font-bold tracking-tight text-white wrap-break-word">
                            {displayName}
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">Their list on MyDramaList</p>
                    </div>
                    {result.data.link && (
                        <a
                            href={result.data.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 h-9 px-3 rounded-lg inline-flex items-center gap-2 text-sm font-medium bg-white/5 text-sky-400 hover:bg-white/8 hover:text-sky-300 transition-all"
                        >
                            <ExternalLink className="size-3.5" />
                            View on MDL
                        </a>
                    )}
                </div>

                {isEmpty ? (
                    // MDL serves two dramalist layouts and the scraper only reads
                    // the classic one, so an empty payload means "couldn't read
                    // it" at least as often as it means "nothing there". Claiming
                    // the list is private would be a confident guess, and wrong
                    // for every account on the newer layout.
                    <div className="py-16 text-center space-y-3">
                        <p className="text-sm font-medium text-white/40">This list couldn&rsquo;t be read here.</p>
                        <p className="text-xs text-white/25 max-w-sm mx-auto">
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
                    <MdlUserList sections={sections} hrefBySlug={hrefBySlug} />
                )}
            </div>
        </div>
    );
}
