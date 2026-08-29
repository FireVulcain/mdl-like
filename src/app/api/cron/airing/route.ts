import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAiringRatings } from "@/lib/cron/airing-ratings";

const CRON_SECRET = process.env.CRON_SECRET;

// Two requests and a handful of upserts. Nothing here needs the five minutes
// /api/cron/sync reserves, and saying so keeps a stuck scrape from holding a
// worker for that long.
export const maxDuration = 60;
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
