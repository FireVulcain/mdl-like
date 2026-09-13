import { NextRequest, NextResponse } from "next/server";
import { kuryanaSearch } from "@/lib/kuryana";
import { mdlPersonSlug } from "@/lib/person-links";

export type PersonSearchHit = { slug: string; name: string; image: string | null; nationality: string | null };

// MDL people only. The co-star lookup is an intersection of two MDL
// filmographies, so a TMDB person would have nothing to intersect.
export async function GET(req: NextRequest) {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json([]);
    const result = await kuryanaSearch(q).catch(() => null);
    const hits: PersonSearchHit[] = (result?.results.people ?? [])
        .map((p) => ({ slug: mdlPersonSlug(p.slug), name: p.name, image: p.thumb || null, nationality: p.nationality || null }))
        .filter((p): p is PersonSearchHit => p.slug !== null)
        .slice(0, 8);
    return NextResponse.json(hits);
}
