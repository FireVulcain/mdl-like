"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

/**
 * Remembers that this reader has opened — or shut — the twists on one
 * drama's chart, so they do not have to say it again on the next visit, or
 * on the next machine. Per user and per chart; see `CharacterMapView`.
 *
 * Nothing here is worth failing a click over: signed out, or the write not
 * going through, the door simply works for this visit alone. The caller
 * does not wait on it.
 */
export async function rememberReveals(mdlSlug: string, reveals: boolean): Promise<void> {
    if (!/^[0-9]+-[a-z0-9-]+$/.test(mdlSlug)) return;
    try {
        const userId = await getCurrentUserId();
        await prisma.characterMapView.upsert({
            where: { userId_mdlSlug: { userId, mdlSlug } },
            create: { userId, mdlSlug, reveals },
            update: { reveals },
        });
    } catch {
        /* nobody signed in, or the database is out of reach */
    }
}
