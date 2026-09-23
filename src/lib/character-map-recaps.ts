import { prisma } from "@/lib/prisma";
import { countryCode, type Recap } from "@/lib/character-map-inputs";

/**
 * The episode recaps kept for a chart — read by the extension from the
 * reader's browser (the sites turn servers away) and posted here. Kept per
 * recap page, so a regeneration reads them again without a fetch, and the
 * preflight can say what a run would read.
 */

/**
 * Where a drama's recaps are read from — decided by its country, never by
 * hand. Dramabeans writes for K-dramas only, and its tag search would find
 * a C-drama's title on an unrelated post; CPOPHome writes one recap per
 * episode for C-dramas. A K-drama has a second site, TheReviewGeek, one
 * recap per episode, often for dramas Dramabeans skips: the panel offers
 * both, and a run reads the one or the two that are ticked. A drama from
 * anywhere else has no source, and the panel says so instead of offering
 * the box.
 */
export type RecapSourceId = "dramabeans" | "thereviewgeek" | "cpophome";
export type RecapSource = { id: RecapSourceId; name: string; host: string };
const DRAMABEANS: RecapSource = { id: "dramabeans", name: "Dramabeans", host: "dramabeans.com" };
const THEREVIEWGEEK: RecapSource = { id: "thereviewgeek", name: "TheReviewGeek", host: "www.thereviewgeek.com" };
const CPOPHOME: RecapSource = { id: "cpophome", name: "CPOPHome", host: "www.cpophome.com" };
const SOURCES: Record<string, RecapSource[]> = {
    KR: [DRAMABEANS, THEREVIEWGEEK],
    CN: [CPOPHOME],
};
export function recapSourcesFor(country: string): RecapSource[] {
    return SOURCES[countryCode(country)] ?? [];
}
export const RECAP_SOURCE_IDS: RecapSourceId[] = ["dramabeans", "thereviewgeek", "cpophome"];

export type RecapSummary = { source: string; count: number; fromEp: number; toEp: number; words: number; fetchedAt: string } | null;

/** The recaps kept for an entry, in episode order — only the given sites' when some are named. */
export async function listRecaps(mdlSlug: string, sources?: string[]): Promise<Recap[]> {
    const rows = await prisma.characterMapRecap.findMany({
        where: { mdlSlug, ...(sources ? { source: { in: sources } } : {}) },
        orderBy: [{ fromEp: "asc" }, { toEp: "asc" }],
    });
    return rows.map((r) => ({ source: r.source, title: r.title, url: r.url, fromEp: r.fromEp, toEp: r.toEp, words: r.words, text: r.text }));
}

/**
 * Which kept recaps a run reads: the sites ticked in the panel; with none
 * ticked, a continue run reads the sites the chart was written with (its
 * `recaps.source`, joined by commas), and a chart that does not say reads
 * everything kept.
 */
export function recapsToRead(kept: Recap[], ticked: string[] | null, chartSource: string | null | undefined): Recap[] {
    const wanted = ticked?.length ? ticked : chartSource ? chartSource.split(",").map((s) => s.trim()).filter(Boolean) : null;
    return wanted ? kept.filter((r) => wanted.includes(r.source)) : kept;
}

/** What is kept for the entry, one summary per site. */
export async function recapSummaries(mdlSlug: string): Promise<Record<string, NonNullable<RecapSummary>>> {
    const rows = await prisma.characterMapRecap.findMany({ where: { mdlSlug }, select: { source: true, fromEp: true, toEp: true, words: true, fetchedAt: true } });
    const bySource = new Map<string, typeof rows>();
    for (const r of rows) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
    const out: Record<string, NonNullable<RecapSummary>> = {};
    for (const [source, list] of bySource) {
        out[source] = {
            source,
            count: list.length,
            fromEp: Math.min(...list.map((r) => r.fromEp)),
            toEp: Math.max(...list.map((r) => r.toEp)),
            words: list.reduce((t, r) => t + r.words, 0),
            fetchedAt: list.reduce((t, r) => (r.fetchedAt > t ? r.fetchedAt : t), list[0].fetchedAt).toISOString(),
        };
    }
    return out;
}

/** What is kept from one site, or null. */
export async function recapSummary(mdlSlug: string, source: string): Promise<RecapSummary> {
    return (await recapSummaries(mdlSlug))[source] ?? null;
}

/** The most one drama's recaps can weigh — 24 Dramabeans episodes at ~2.5K words is 60K; a 56-episode C-drama at ~2K is 110K. Counted per site. */
export const MAX_RECAP_WORDS = 150_000;

/**
 * Why a set of recaps is not one drama's, or null when it looks like one.
 * A tag on Dramabeans that is not the drama's ("first impressions") once
 * sent 44 dramas' first episodes into one run, at 368K tokens — so a set
 * whose titles name more than one show, or that weighs too much, is
 * refused before it is kept, let alone read. Each site is held to it on its
 * own: two sites' recaps of one drama name it their own way, and each has
 * its episode 1.
 */
export function recapsProblem(recaps: { source?: string; title: string; fromEp: number; toEp: number; words: number }[]): string | null {
    const bySource = new Map<string, typeof recaps>();
    for (const r of recaps) bySource.set(r.source ?? "", [...(bySource.get(r.source ?? "") ?? []), r]);
    for (const [source, list] of bySource) {
        const problem = oneSiteProblem(list);
        if (problem) return bySource.size > 1 && source ? `${source}: ${problem}` : problem;
    }
    return null;
}

function oneSiteProblem(recaps: { title: string; fromEp: number; toEp: number; words: number }[]): string | null {
    const fold = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const shows = new Set(recaps.map((r) => fold(r.title.split(/:\s*Episode/i)[0])).filter(Boolean));
    if (shows.size > 1) return `these recaps name ${shows.size} different dramas — the tag was not this drama's`;
    const words = recaps.reduce((t, r) => t + r.words, 0);
    if (words > MAX_RECAP_WORDS) return `${Math.round(words / 1000)}K words of recaps is more than one drama's — the tag was not this drama's`;
    const firsts = recaps.filter((r) => r.fromEp === 1).length;
    if (firsts > 2) return `${firsts} recaps of episode 1 — the tag was not this drama's`;
    return null;
}

/**
 * Replaces what is kept from one site for the entry with these recaps — a
 * fresh read is that site's whole set; the other site's recaps stay.
 * `source` names the site, and where a recap came from when it does not
 * say itself (a pasted set). Throws on a set that is not one drama's.
 */
export async function saveRecaps(mdlSlug: string, recaps: Omit<Recap, "words">[], source = "dramabeans"): Promise<number> {
    const rows = recaps
        .filter((r) => r.url && r.text.trim() && r.fromEp >= 1 && r.toEp >= r.fromEp)
        .map((r) => ({ mdlSlug, source: r.source || source, url: r.url, title: r.title, fromEp: r.fromEp, toEp: r.toEp, words: r.text.trim().split(/\s+/).length, text: r.text.trim() }));
    const problem = recapsProblem(rows);
    if (problem) throw new Error(problem);
    const replaced = [...new Set([source, ...rows.map((r) => r.source)])];
    await prisma.$transaction([
        prisma.characterMapRecap.deleteMany({ where: { mdlSlug, source: { in: replaced } } }),
        ...(rows.length ? [prisma.characterMapRecap.createMany({ data: rows })] : []),
    ]);
    return rows.length;
}
