import { prisma } from "@/lib/prisma";
import type { Recap } from "@/lib/character-map-inputs";

/**
 * The episode recaps kept for a chart — Dramabeans, read by the extension
 * from the reader's browser (the site turns servers away) and posted here.
 * Kept per recap page, so a regeneration reads them again without a fetch,
 * and the preflight can say what a run would read.
 */
export type RecapSummary = { source: string; count: number; fromEp: number; toEp: number; words: number; fetchedAt: string } | null;

export async function listRecaps(mdlSlug: string): Promise<Recap[]> {
    const rows = await prisma.characterMapRecap.findMany({ where: { mdlSlug }, orderBy: [{ fromEp: "asc" }, { toEp: "asc" }] });
    return rows.map((r) => ({ source: r.source, title: r.title, url: r.url, fromEp: r.fromEp, toEp: r.toEp, words: r.words, text: r.text }));
}

export async function recapSummary(mdlSlug: string): Promise<RecapSummary> {
    const rows = await prisma.characterMapRecap.findMany({ where: { mdlSlug }, select: { source: true, fromEp: true, toEp: true, words: true, fetchedAt: true } });
    if (rows.length === 0) return null;
    return {
        source: rows[0].source,
        count: rows.length,
        fromEp: Math.min(...rows.map((r) => r.fromEp)),
        toEp: Math.max(...rows.map((r) => r.toEp)),
        words: rows.reduce((t, r) => t + r.words, 0),
        fetchedAt: rows.reduce((t, r) => (r.fetchedAt > t ? r.fetchedAt : t), rows[0].fetchedAt).toISOString(),
    };
}

/** The most one drama's recaps can weigh — 24 episodes at ~2.5K words is 60K. */
export const MAX_RECAP_WORDS = 90_000;

/**
 * Why a set of recaps is not one drama's, or null when it looks like one.
 * A tag on Dramabeans that is not the drama's ("first impressions") once
 * sent 44 dramas' first episodes into one run, at 368K tokens — so a set
 * whose titles name more than one show, or that weighs too much, is
 * refused before it is kept, let alone read.
 */
export function recapsProblem(recaps: { title: string; fromEp: number; toEp: number; words: number }[]): string | null {
    const fold = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const shows = new Set(recaps.map((r) => fold(r.title.split(/:\s*Episode/i)[0])).filter(Boolean));
    if (shows.size > 1) return `these recaps name ${shows.size} different dramas — the tag was not this drama's`;
    const words = recaps.reduce((t, r) => t + r.words, 0);
    if (words > MAX_RECAP_WORDS) return `${Math.round(words / 1000)}K words of recaps is more than one drama's — the tag was not this drama's`;
    const firsts = recaps.filter((r) => r.fromEp === 1).length;
    if (firsts > 2) return `${firsts} recaps of episode 1 — the tag was not this drama's`;
    return null;
}

/** Replaces what is kept for the entry with these recaps — a fresh read is the whole set. Throws on a set that is not one drama's. */
export async function saveRecaps(mdlSlug: string, recaps: Omit<Recap, "words">[]): Promise<number> {
    const rows = recaps
        .filter((r) => r.url && r.text.trim() && r.fromEp >= 1 && r.toEp >= r.fromEp)
        .map((r) => ({ mdlSlug, source: r.source || "dramabeans", url: r.url, title: r.title, fromEp: r.fromEp, toEp: r.toEp, words: r.text.trim().split(/\s+/).length, text: r.text.trim() }));
    const problem = recapsProblem(rows);
    if (problem) throw new Error(problem);
    await prisma.$transaction([
        prisma.characterMapRecap.deleteMany({ where: { mdlSlug } }),
        ...(rows.length ? [prisma.characterMapRecap.createMany({ data: rows })] : []),
    ]);
    return rows.length;
}
