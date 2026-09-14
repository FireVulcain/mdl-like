import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { CharacterMapData } from "@/lib/character-map";
import { applyStills, type StillRow } from "@/lib/character-map-stills";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Receives one asianwiki cast table, read in the reader's browser by the
 * extension, and writes the stills it matches into the chart.
 *
 * The chart row is updated wherever this runs. In development the JSON file
 * in prisma/character-maps/ is rewritten too: the files are the source of
 * truth — the seed script replaces the rows from them — so a still that only
 * reached the database would be gone at the next seed.
 */
function corsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return headers;
}

export async function OPTIONS(request: Request) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) });
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    try {
        await getCurrentUserId();
    } catch {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(origin) });
    }

    const body = (await request.json().catch(() => null)) as { mdlSlug?: string; page?: string; rows?: StillRow[] } | null;
    const rows = (body?.rows ?? []).filter((r) => r && typeof r.image === "string" && /^https:\/\/asianwiki\.com\//.test(r.image));
    if (!body?.mdlSlug || rows.length === 0) {
        return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: corsHeaders(origin) });
    }

    // The file, when there is one, is read as well as written: Postgres
    // stores JSON as jsonb and hands the keys back in its own order, so a
    // chart that went through the row and back would rewrite every line of
    // its file for a few stills.
    const filePath = path.join(process.cwd(), "prisma", "character-maps", `${body.mdlSlug}.json`);
    const file = process.env.NODE_ENV !== "production" && fs.existsSync(filePath) ? filePath : null;
    let map: CharacterMapData | null = null;
    if (file) map = JSON.parse(fs.readFileSync(file, "utf-8")) as CharacterMapData;
    else {
        const row = await prisma.characterMap.findUnique({ where: { mdlSlug: body.mdlSlug } });
        if (row) map = row.dataJson as unknown as CharacterMapData;
    }
    if (!map) return NextResponse.json({ error: "No chart" }, { status: 404, headers: corsHeaders(origin) });

    const result = applyStills(map, rows);
    const dataJson = result.map as unknown as Prisma.InputJsonValue;
    await prisma.characterMap.update({ where: { mdlSlug: body.mdlSlug }, data: { dataJson } });
    if (file) fs.writeFileSync(file, JSON.stringify(result.map, null, 2) + "\n", "utf-8");

    return NextResponse.json(
        { matched: Object.keys(result.matched).length, people: result.map.people.length, unmatched: result.unmatched, unused: result.unused, file: file ? path.basename(file) : null },
        { headers: corsHeaders(origin) },
    );
}
