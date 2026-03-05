import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const userId = await getCurrentUserId();
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { image: true },
        });

        if (!user?.image) {
            return new NextResponse(null, { status: 404 });
        }

        const match = user.image.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
            return new NextResponse(null, { status: 404 });
        }

        const [, contentType, base64Data] = match;
        const buffer = Buffer.from(base64Data, "base64");

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "no-store",
            },
        });
    } catch {
        return new NextResponse(null, { status: 401 });
    }
}
