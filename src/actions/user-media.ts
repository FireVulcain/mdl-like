"use server";

import { prisma } from "@/lib/prisma";

const MOCK_USER_ID = "mock-user-1";

// Helper to get user specific media data
export async function getUserMedia(userId: string, externalId: string, source: string, season: number = 1) {
  if (!userId) return null;

  return await prisma.userMedia.findFirst({
    where: {
      userId,
      externalId,
      source,
      season,
    }
  });
}

// Get all externalIds in user's watchlist (for batch checking)
// Returns an array since Sets can't be serialized across client-server boundary
export async function getWatchlistExternalIds(): Promise<string[]> {
  const items = await prisma.userMedia.findMany({
    where: { userId: MOCK_USER_ID },
    select: { externalId: true }
  });

  return items.map(item => item.externalId);
}
