import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { gatherChartInputs } from "@/lib/character-map-inputs";
import { recapSummary, type RecapSummary } from "@/lib/character-map-recaps";

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
};

export async function POST(request: Request) {
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; titles?: Record<string, string> } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return NextResponse.json({ error: "Invalid mdlSlug" }, { status: 400 });
    const titles: Record<string, string> = {};
    for (const [lang, title] of Object.entries(body?.titles ?? {})) if (/^(ko|zh|en|ja)$/.test(lang) && typeof title === "string" && title.trim()) titles[lang] = title.trim();
    try {
        const [inputs, recaps] = await Promise.all([gatherChartInputs(mdlSlug, titles), recapSummary(mdlSlug)]);
        const preflight: Preflight = {
            recaps,
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
