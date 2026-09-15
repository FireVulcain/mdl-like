import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getCurrentUserId } from "@/lib/session";
import { startJob } from "@/lib/character-map-jobs";

export const dynamic = "force-dynamic";

/**
 * Starts a chart run for one MDL entry. Admin only — the button is hidden
 * for everyone else, and this is the check that hides the action. Returns
 * the job row to poll; a run already going for the entry is returned as is.
 */
export async function POST(request: Request) {
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; titles?: Record<string, string> } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return NextResponse.json({ error: "Invalid mdlSlug" }, { status: 400 });
    const titles: Record<string, string> = {};
    for (const [lang, title] of Object.entries(body?.titles ?? {})) if (/^(ko|zh|en|ja)$/.test(lang) && typeof title === "string" && title.trim()) titles[lang] = title.trim();
    const userId = await getCurrentUserId().catch(() => null);
    const job = await startJob(mdlSlug, userId, titles);
    return NextResponse.json({ job });
}
