import { NextRequest, NextResponse } from "next/server";
import { kuryanaSearchTags } from "@/lib/kuryana";

// Through kuryanaSearchTags rather than its own fetch, so the call is cached
// and logged like every other scraper read.
export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json(await kuryanaSearchTags(q));
}
