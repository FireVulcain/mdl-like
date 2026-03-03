"use server";

import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 600_000; // ~450KB raw → ~600KB base64

export async function updateAvatar(dataUrl: string): Promise<{ ok: boolean; error?: string }> {
    let userId: string;
    try {
        userId = await getCurrentUserId();
    } catch {
        return { ok: false, error: "Not authenticated" };
    }

    if (!dataUrl.startsWith("data:image/")) {
        return { ok: false, error: "Invalid image format" };
    }
    if (dataUrl.length > MAX_BYTES) {
        return { ok: false, error: "Image too large. Please use a smaller image." };
    }

    await prisma.user.update({
        where: { id: userId },
        data: { image: dataUrl },
    });

    return { ok: true };
}
