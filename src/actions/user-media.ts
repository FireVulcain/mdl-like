"use server";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/session";

// Helper to get user specific media data
// Wrapped with React.cache() for per-request deduplication
export const getUserMedia = cache(async (userId: string, externalId: string, source: string, season: number = 1) => {
  if (!userId) return null;

  return await prisma.userMedia.findFirst({
    where: {
      userId,
      externalId,
      source,
      season,
    }
  });
});

// Get all externalIds in user's watchlist (for batch checking).
// Also resolves MDL↔TMDB links so a show added under one ID is recognised under its linked ID too.
// Returns an array since Sets can't be serialized across client-server boundary.
// Wrapped with React.cache() for per-request deduplication.
export const getWatchlistExternalIds = cache(async (): Promise<string[]> => {
  const userId = await getCurrentUserId();
  const items = await prisma.userMedia.findMany({
    where: { userId },
    select: { externalId: true, source: true },
  });

  const ids = items.map((i) => i.externalId);

  // Resolve linked IDs via CachedMdlData (TMDB ↔ MDL)
  const tmdbIds = items.filter((i) => i.source === "TMDB").map((i) => i.externalId);
  const mdlSlugs = items.filter((i) => i.source === "MDL").map((i) => i.externalId);

  if (tmdbIds.length === 0 && mdlSlugs.length === 0) return ids;

  const links = await prisma.cachedMdlData.findMany({
    where: { OR: [{ tmdbExternalId: { in: tmdbIds } }, { mdlSlug: { in: mdlSlugs } }] },
    select: { tmdbExternalId: true, mdlSlug: true },
  });

  const linkedIds = links.flatMap((l) => [l.tmdbExternalId, l.mdlSlug]);
  return [...new Set([...ids, ...linkedIds])];
});
