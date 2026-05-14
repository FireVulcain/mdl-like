import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { getScheduleEntries } from "@/actions/schedule";

export const dynamic = "force-dynamic";

// Allow Chrome extension origins (and any other clients that pass credentials)
function corsHeaders(origin: string | null) {
    const headers: Record<string, string> = {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };
    // Chrome extension origins look like "chrome-extension://..."
    // We reflect the request origin so credentialed fetches work
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    return headers;
}

export async function OPTIONS(request: Request) {
    const origin = request.headers.get("origin");
    return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: Request) {
    const origin = request.headers.get("origin");
    const userId = await getCurrentUserId();

    if (!userId) {
        return NextResponse.json(
            { error: "Not authenticated" },
            { status: 401, headers: corsHeaders(origin) }
        );
    }

    const entries = await getScheduleEntries();
    return NextResponse.json(entries, { headers: corsHeaders(origin) });
}
