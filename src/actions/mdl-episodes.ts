"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";
import { kuryanaGetEpisode } from "@/lib/kuryana";
import { EMPTY_SYNOPSIS_TTL_MS } from "@/lib/mdl-episodes";

export type EpisodeSynopsisResult =
    | { status: "ok"; synopsis: string; title: string | null }
    | { status: "none" }
    | { status: "error" };

/**
 * One episode's synopsis, asked for from the episode guide's "Show synopsis".
 *
 * The guide used to scrape every episode's page to fill a one-line preview the
 * reader mostly never opened — a call per episode, 24 for a 24-episode show,
 * and the empty ones again every day. Now the database answers when it can,
 * and only the episode the reader asked about goes to MDL. An empty answer is
 * remembered for a week; a failed one is not remembered at all.
 */
export async function loadEpisodeSynopsis(mdlSlug: string, episodeNumber: number): Promise<EpisodeSynopsisResult> {
    await getCurrentUserId();
    if (!/^\d+-[\w.%-]+$/.test(mdlSlug) || !Number.isInteger(episodeNumber) || episodeNumber < 1 || episodeNumber > 2000) {
        return { status: "error" };
    }

    const row = await prisma.cachedMdlEpisode.findUnique({
        where: { mdlSlug_episodeNumber: { mdlSlug, episodeNumber } },
    });
    if (row?.synopsis?.trim()) return { status: "ok", synopsis: row.synopsis, title: row.episodeTitle };
    if (row && Date.now() - row.cachedAt.getTime() < EMPTY_SYNOPSIS_TTL_MS) return { status: "none" };

    const detail = await kuryanaGetEpisode(mdlSlug, episodeNumber);
    if (!detail?.data) return { status: "error" };

    const synopsis = detail.data.synopsis?.trim() || null;
    const title = detail.data.episode_title?.trim() || null;
    await prisma.cachedMdlEpisode.upsert({
        where: { mdlSlug_episodeNumber: { mdlSlug, episodeNumber } },
        create: { mdlSlug, episodeNumber, synopsis, episodeTitle: title },
        update: { synopsis, episodeTitle: title, cachedAt: new Date() },
    });
    return synopsis ? { status: "ok", synopsis, title } : { status: "none" };
}
