import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { recapSummary, saveRecaps } from "@/lib/character-map-recaps";

export const dynamic = "force-dynamic";

/**
 * Receives the episode recaps of one entry — read on Dramabeans by the
 * extension from the reader's browser, or pasted by hand — and keeps them
 * for the chart's next run. A post replaces the set. GET says what is kept.
 * Admin only: this is the generate button's material.
 */
function corsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return headers;
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

type RecapIn = { source?: string; title?: string; url?: string; from?: number; to?: number; text?: string };

export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders(origin) });
    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; recaps?: RecapIn[] } | null;
    const mdlSlug = body?.mdlSlug?.trim();
    if (!mdlSlug || !/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug) || !Array.isArray(body?.recaps)) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: corsHeaders(origin) });
    }
    const recaps = body.recaps
        .filter((r) => r && typeof r.text === "string" && Number.isInteger(r.from))
        // A pasted recap has no URL; the range stands in, so the set still keys on it
        .map((r) => ({
            source: typeof r.source === "string" && r.source.trim() ? r.source.trim().slice(0, 40) : "dramabeans",
            title: (typeof r.title === "string" ? r.title : "").slice(0, 200),
            url: (typeof r.url === "string" && r.url.trim() ? r.url.trim() : `pasted#ep${r.from}-${Number.isInteger(r.to) ? r.to : r.from}`).slice(0, 500),
            fromEp: r.from as number,
            toEp: Number.isInteger(r.to) ? (r.to as number) : (r.from as number),
            text: (r.text as string).slice(0, 60_000),
        }));
    const count = await saveRecaps(mdlSlug, recaps);
    const summary = await recapSummary(mdlSlug);
    return NextResponse.json({ count, summary }, { headers: corsHeaders(origin) });
}

export async function GET(request: Request) {
    const origin = request.headers.get("origin");
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders(origin) });
    const mdlSlug = new URL(request.url).searchParams.get("mdlSlug")?.trim();
    if (!mdlSlug) return NextResponse.json({ error: "mdlSlug" }, { status: 400, headers: corsHeaders(origin) });
    return NextResponse.json({ summary: await recapSummary(mdlSlug) }, { headers: corsHeaders(origin) });
}
