import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { gatherChartInputs, recapEpisodeOffset } from "@/lib/character-map-inputs";
import { listRecaps, recapSourcesFor, recapsToRead, recapSummaries, RECAP_SOURCE_IDS, type RecapSource, type RecapSummary } from "@/lib/character-map-recaps";
import { planRun, readContext, type RunMode } from "@/lib/character-map-patch";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData } from "@/lib/character-map";

export const dynamic = "force-dynamic";

/**
 * What a run would read, before it costs anything: the MDL cast and the
 * Wikipedia articles a search finds (or rejects) for one entry, with the
 * titles given by hand applied. The reading is free — only the model is
 * not — so the panel shows this before the Write button, and a wrong
 * article is fixed before a run, not after one.
 */
export type Preflight = {
    title: string;
    /** what the recap site is asked for: the country decides the site, the rest finds the drama there */
    drama: {
        country: string;
        year: number | null;
        episodes: number | null;
        akas: string[];
        /** where this entry's recaps can come from, by country — two sites for a K-drama; empty for a country no site covers */
        sources: RecapSource[];
        /** recaps counted before this entry's episode 1 on the site — "Part 2" of a split airing */
        episodeOffset: number;
    };
    cast: { main: number; support: number; guest: number };
    synopsis: boolean;
    wiki: { lang: string; title: string | null; found: boolean; chars: number; rejected?: string; failed?: boolean }[];
    /** the episode recaps kept for the entry, per site, for the sites the extension has read */
    recaps: Record<string, NonNullable<RecapSummary>>;
    /**
     * What a run would do: write the chart, carry it forward over the recaps
     * it has not read, or nothing. Worked out here so the panel can say it
     * before anything is spent.
     */
    plan: {
        mode: RunMode;
        /** the last episode the chart says it has read */
        coveredTo: number;
        /** the new recaps, and the episodes they cover */
        fresh: number;
        freshFrom: number;
        freshTo: number;
        /** covered recaps with no digest kept — read in full, once, on the next continue run */
        undigested: number;
        reason: string;
    };
    /** when a link was last written by hand — a full run would throw it away */
    editedAt: string | null;
};

export async function POST(request: Request) {
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    // `sources`: the recap sites ticked in the panel — the plan is what a run reading those would do.
    // `planOnly`: just the plan and the recaps kept, for a tick in the panel. Neither
    // depends on the MDL entry or Wikipedia, and reading those again on every tick
    // is what got the Wikipedia lookups throttled.
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; titles?: Record<string, string>; sources?: unknown; planOnly?: boolean } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return NextResponse.json({ error: "Invalid mdlSlug" }, { status: 400 });
    const titles: Record<string, string> = {};
    for (const [lang, title] of Object.entries(body?.titles ?? {})) if (/^(ko|zh|en|ja)$/.test(lang) && typeof title === "string" && title.trim()) titles[lang] = title.trim();
    const ticked = Array.isArray(body?.sources) ? RECAP_SOURCE_IDS.filter((id) => (body.sources as unknown[]).includes(id)) : null;
    const planOf = async () => {
        const [recaps, kept, row] = await Promise.all([
            recapSummaries(mdlSlug),
            listRecaps(mdlSlug),
            prisma.characterMap.findUnique({ where: { mdlSlug }, select: { dataJson: true, contextJson: true, editedAt: true } }).catch(() => null),
        ]);
        const map = (row?.dataJson as unknown as CharacterMapData) ?? null;
        const plan = planRun(map, recapsToRead(kept, ticked, map?.recaps?.source), readContext(row?.contextJson));
        return {
            recaps,
            row,
            plan: {
                mode: plan.mode,
                coveredTo: plan.coveredTo,
                fresh: plan.fresh.length,
                freshFrom: plan.fresh.length ? Math.min(...plan.fresh.map((r) => r.fromEp)) : 0,
                freshTo: plan.fresh.length ? Math.max(...plan.fresh.map((r) => r.toEp)) : 0,
                undigested: plan.undigested.length,
                reason: plan.reason,
            } satisfies Preflight["plan"],
        };
    };
    try {
        if (body?.planOnly) {
            const { recaps, plan } = await planOf();
            return NextResponse.json({ plan, recaps });
        }
        const [inputs, { recaps, row, plan }] = await Promise.all([gatherChartInputs(mdlSlug, titles), planOf()]);
        const sources = recapSourcesFor(inputs.country);
        const preflight: Preflight = {
            recaps,
            drama: {
                country: inputs.country,
                year: inputs.year,
                episodes: inputs.episodes,
                akas: inputs.akas,
                sources,
                episodeOffset: sources.length ? await recapEpisodeOffset(inputs) : 0,
            },
            editedAt: row?.editedAt?.toISOString() ?? null,
            plan,
            title: inputs.title,
            cast: { main: inputs.cast.main.length, support: inputs.cast.support.length, guest: inputs.cast.guest.length },
            synopsis: inputs.synopsis.trim().length > 0,
            wiki: inputs.wiki.map((w) => ({ lang: w.lang, title: w.title, found: !!w.text, chars: w.text?.length ?? 0, rejected: w.rejected, failed: w.failed })),
        };
        return NextResponse.json({ preflight });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
    }
}
