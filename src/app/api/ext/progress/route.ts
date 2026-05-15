import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { updateProgress } from "@/actions/media";

export const dynamic = "force-dynamic";

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
    const origin = request.headers.get("origin");
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(request: Request) {
    const origin = request.headers.get("origin");
    const userId = await getCurrentUserId();

    if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders(origin) });
    }

    const { mediaId, episode } = await request.json();
    if (!mediaId || typeof episode !== "number") {
        return NextResponse.json({ error: "Invalid body" }, { status: 400, headers: corsHeaders(origin) });
    }

    // mediaId format: "tmdb-{externalId}"
    const dashIndex = mediaId.indexOf("-");
    const source = mediaId.slice(0, dashIndex).toUpperCase();
    const externalId = mediaId.slice(dashIndex + 1);

    const record = await prisma.userMedia.findFirst({
        where: { userId, externalId, source },
    });

    if (!record) {
        return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders(origin) });
    }

    const newProgress = Math.max(record.progress, episode);
    await updateProgress(record.id, newProgress);

    return NextResponse.json({ progress: newProgress }, { headers: corsHeaders(origin) });
}
