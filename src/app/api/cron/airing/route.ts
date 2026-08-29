import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAiringRatings } from "@/lib/cron/airing-ratings";

const CRON_SECRET = process.env.CRON_SECRET;

// Sixty was right when this was two list calls. It now also opens each airing
// title's own page for its watchers and rank — about twenty-four requests at a
// 500ms spacing, so roughly twenty seconds today, and more as an airing season
// fills out. Matched to the Coolify task's own timeout rather than left at a
// number a busy season would quietly cross.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The airing-ratings reading, on its own schedule.
 *
 * Split out of /api/cron/sync because sharing that route meant sharing its
 * budget, and the watchlist refresh in it is greedy by design — it works down
 * its queue until 270 of 300 seconds are gone. Anything alongside it runs only
 * on the days it finishes early, which for a watchlist that keeps growing means
 * never. Coolify takes more than one scheduled task, so this gets its own hour
 * and its own failure: neither job can now cost the other its day.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await recordAiringRatings();

    // Its own row rather than the sync's, so one job's log cannot overwrite the
    // other's and "when did this last run" stays answerable per job.
    await prisma.syncLog.upsert({
        where: { id: "airing-ratings" },
        update: { lastSync: new Date(), results: { ...result, timestamp: new Date().toISOString() } },
        create: { id: "airing-ratings", lastSync: new Date(), results: { ...result, timestamp: new Date().toISOString() } },
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
