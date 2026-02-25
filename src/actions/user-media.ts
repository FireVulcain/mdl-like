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

// Get all externalIds in user's watchlist (for batch checking)
// Returns an array since Sets can't be serialized across client-server boundary
// Wrapped with React.cache() for per-request deduplication
export const getWatchlistExternalIds = cache(async (): Promise<string[]> => {
  const userId = await getCurrentUserId();
  const items = await prisma.userMedia.findMany({
    where: { userId },
    select: { externalId: true }
  });

  return items.map(item => item.externalId);
});
