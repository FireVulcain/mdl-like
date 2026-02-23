import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
    const { tmdbExternalId, mediaId } = await req.json();

    if (!tmdbExternalId || typeof tmdbExternalId !== "string") {
        return Response.json({ error: "Missing tmdbExternalId" }, { status: 400 });
    }

    await prisma.cachedMdlData.deleteMany({ where: { tmdbExternalId } });

    if (mediaId) {
        revalidatePath(`/media/${mediaId}`);
    }

    return Response.json({ ok: true });
}
