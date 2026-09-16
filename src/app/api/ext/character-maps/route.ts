import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData } from "@/lib/character-map";
import { countryCode } from "@/lib/character-map-inputs";

export const dynamic = "force-dynamic";

/**
 * The charts that exist, for the extension's stills run: which titles to
 * look up on asianwiki, and how many faces each still lacks. Korean and
 * Japanese only — asianwiki barely covers China, and a search there lands
 * on a homonym.
 */
function corsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return headers;
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function GET(request: Request) {
    const origin = request.headers.get("origin");
    try {
        await getCurrentUserId();
    } catch {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(origin) });
    }
    const rows = await prisma.characterMap.findMany({ select: { mdlSlug: true, dataJson: true } });
    const charts = rows
        .map((r) => r.dataJson as unknown as CharacterMapData)
        .filter((d) => ["KR", "JP"].includes(countryCode(d.country ?? "")))
        .map((d) => ({
            mdlSlug: d.mdlSlug,
            title: d.title,
            asianwiki: d.asianwiki ?? null,
            year: d.year ?? null,
            people: d.people.length,
            withStill: d.people.filter((p) => p.still).length,
        }))
        .sort((a, b) => a.title.localeCompare(b.title));
    return NextResponse.json({ charts }, { headers: corsHeaders(origin) });
}
