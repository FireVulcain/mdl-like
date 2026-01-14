import { prisma } from "@/lib/prisma";

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
