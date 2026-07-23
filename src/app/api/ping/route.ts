import { prisma } from "@/lib/prisma";

// Keep-alive endpoint for an external pinger. A static response would only warm
// an empty Node runtime; the expensive part of a cold start is instantiating the
// Prisma client and opening the Supabase connection, so touch the DB for real.
export async function GET() {
    const started = Date.now();
    try {
        await prisma.userMedia.count();
        return Response.json({ ok: true, db: true, ms: Date.now() - started });
    } catch {
        // Never fail the ping on a DB hiccup — the pinger would report downtime
        return Response.json({ ok: true, db: false, ms: Date.now() - started });
    }
}
