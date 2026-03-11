import { NextRequest, NextResponse } from "next/server";

const BASE_URL = process.env.KURYANA_URL ?? "https://mdl-scrapper-jade.vercel.app";

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    if (q.length < 2) return NextResponse.json([]);
    try {
        const res = await fetch(`${BASE_URL}/tags/search?q=${encodeURIComponent(q)}`, {
            next: { revalidate: 3600 },
        });
        if (!res.ok) return NextResponse.json([]);
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json([]);
    }
}
