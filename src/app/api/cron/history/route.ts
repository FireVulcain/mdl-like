import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordRecentlyFinished } from "@/lib/cron/recent-history";

const CRON_SECRET = process.env.CRON_SECRET;

// About thirty-six titles at a 600ms spacing, so roughly forty seconds. Matched
// to the Coolify task's own timeout rather than left at a number a growing
// watchlist would quietly cross.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The third scheduled job, and the third for the same reason as the second.
 *
 * /api/cron/sync is greedy by design — it works its queue until 270 of its 300
 * seconds are gone — so anything sharing that route runs only on the days it
 * finishes early, which for a watchlist that keeps growing means never. Coolify
 * takes as many scheduled tasks as it is given, so this gets its own hour, its
 * own failure, and its own SyncLog row.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await recordRecentlyFinished();

    await prisma.syncLog.upsert({
        where: { id: "recent-history" },
        update: { lastSync: new Date(), results: { ...result, timestamp: new Date().toISOString() } },
        create: { id: "recent-history", lastSync: new Date(), results: { ...result, timestamp: new Date().toISOString() } },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
