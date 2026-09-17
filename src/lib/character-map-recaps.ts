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

/** Replaces what is kept for the entry with these recaps — a fresh read is the whole set. */
export async function saveRecaps(mdlSlug: string, recaps: Omit<Recap, "words">[]): Promise<number> {
    const rows = recaps
        .filter((r) => r.url && r.text.trim() && r.fromEp >= 1 && r.toEp >= r.fromEp)
        .map((r) => ({ mdlSlug, source: r.source || "dramabeans", url: r.url, title: r.title, fromEp: r.fromEp, toEp: r.toEp, words: r.text.trim().split(/\s+/).length, text: r.text.trim() }));
    await prisma.$transaction([
        prisma.characterMapRecap.deleteMany({ where: { mdlSlug } }),
        ...(rows.length ? [prisma.characterMapRecap.createMany({ data: rows })] : []),
    ]);
    return rows.length;
}
