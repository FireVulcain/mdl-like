import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { gatherChartInputs } from "@/lib/character-map-inputs";
import { listRecaps, recapSummary, type RecapSummary } from "@/lib/character-map-recaps";
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
    cast: { main: number; support: number; guest: number };
    synopsis: boolean;
    wiki: { lang: string; title: string | null; found: boolean; chars: number; rejected?: string }[];
    /** the episode recaps kept for the entry, if the extension has read any */
    recaps: RecapSummary;
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
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; titles?: Record<string, string> } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return NextResponse.json({ error: "Invalid mdlSlug" }, { status: 400 });
    const titles: Record<string, string> = {};
    for (const [lang, title] of Object.entries(body?.titles ?? {})) if (/^(ko|zh|en|ja)$/.test(lang) && typeof title === "string" && title.trim()) titles[lang] = title.trim();
    try {
        const [inputs, recaps, kept, row] = await Promise.all([
            gatherChartInputs(mdlSlug, titles),
            recapSummary(mdlSlug),
            listRecaps(mdlSlug),
            prisma.characterMap.findUnique({ where: { mdlSlug }, select: { dataJson: true, contextJson: true, editedAt: true } }).catch(() => null),
        ]);
        const map = (row?.dataJson as unknown as CharacterMapData) ?? null;
        const plan = planRun(map, kept, readContext(row?.contextJson));
        const preflight: Preflight = {
            recaps,
            editedAt: row?.editedAt?.toISOString() ?? null,
            plan: {
                mode: plan.mode,
                coveredTo: plan.coveredTo,
                fresh: plan.fresh.length,
                freshFrom: plan.fresh.length ? Math.min(...plan.fresh.map((r) => r.fromEp)) : 0,
                freshTo: plan.fresh.length ? Math.max(...plan.fresh.map((r) => r.toEp)) : 0,
                undigested: plan.undigested.length,
                reason: plan.reason,
            },
            title: inputs.title,
            cast: { main: inputs.cast.main.length, support: inputs.cast.support.length, guest: inputs.cast.guest.length },
            synopsis: inputs.synopsis.trim().length > 0,
            wiki: inputs.wiki.map((w) => ({ lang: w.lang, title: w.title, found: !!w.text, chars: w.text?.length ?? 0, rejected: w.rejected })),
        };
        return NextResponse.json({ preflight });
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : "failed" }, { status: 502 });
    }
}
