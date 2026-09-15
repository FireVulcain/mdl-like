import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { getJob } from "@/lib/character-map-jobs";

export const dynamic = "force-dynamic";

/** One job row, for the button to poll while a run goes. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    if (!(await isAdminUser())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id } = await params;
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ job });
}
