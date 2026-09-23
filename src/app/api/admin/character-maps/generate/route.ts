import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUserId } from "@/lib/session";
import { startJob } from "@/lib/character-map-jobs";
import { RECAP_SOURCE_IDS } from "@/lib/character-map-recaps";
import { DEFAULT_GENERATOR_MODEL, GENERATOR_MODELS, type GeneratorModel } from "@/lib/character-map-models";

export const dynamic = "force-dynamic";

/**
 * Starts a chart run for one MDL entry. Admin only — the button is hidden
 * for everyone else, and this is the check that hides the action. Returns
 * the job row to poll; a run already going for the entry is returned as is.
 */
export async function POST(request: Request) {
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; titles?: Record<string, string>; model?: string; recaps?: unknown; mode?: string } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return NextResponse.json({ error: "Invalid mdlSlug" }, { status: 400 });
    const titles: Record<string, string> = {};
    for (const [lang, title] of Object.entries(body?.titles ?? {})) if (/^(ko|zh|en|ja)$/.test(lang) && typeof title === "string" && title.trim()) titles[lang] = title.trim();
    const model: GeneratorModel = body?.model && body.model in GENERATOR_MODELS ? (body.model as GeneratorModel) : DEFAULT_GENERATOR_MODEL;
    const userId = await getCurrentUserId().catch(() => null);
    // "continue" carries an existing chart forward over the recaps it has not
    // read; anything else writes the chart again from the sources.
    const mode = body?.mode === "continue" ? "continue" : "full";
    // `recaps`: the recap sites to read, as ticked in the panel (true, from an
    // older page, is every site kept)
    const recaps = body?.recaps === true ? [...RECAP_SOURCE_IDS] : Array.isArray(body?.recaps) ? RECAP_SOURCE_IDS.filter((id) => (body.recaps as unknown[]).includes(id)) : [];
    const job = await startJob(mdlSlug, userId, titles, model, recaps, mode);
    return NextResponse.json({ job });
}
