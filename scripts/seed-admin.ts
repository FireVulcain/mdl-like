import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
    const email = process.env.ADMIN_EMAIL || "admin@mediatracker.local";
    const password = process.env.ADMIN_PASSWORD;

    if (!password) {
        console.error("ERROR: ADMIN_PASSWORD environment variable is required");
        console.error("Set it in your .env file or pass it directly:");
        console.error("  ADMIN_PASSWORD=your-secure-password npx tsx scripts/seed-admin.ts");
        process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Look up by email (the natural unique key) to support fresh deployments
    // Also check legacy "mock-user-1" ID so existing data is preserved during migration
    const byEmail = await prisma.user.findUnique({ where: { email } });
    const byLegacyId = await prisma.user.findUnique({ where: { id: "mock-user-1" } });
    const existingUser = byEmail ?? byLegacyId;

    let user;
    if (existingUser) {
        user = await prisma.user.update({
            where: { id: existingUser.id },
            data: { email, name: "Admin", password: hashedPassword },
        });
        console.log(`Admin user updated: ${user.email} (id: ${user.id})`);
    } else {
        // Fresh deployment — let Prisma generate a real cuid
        user = await prisma.user.create({
            data: { email, name: "Admin", password: hashedPassword },
        });
        console.log(`Admin user created: ${user.email} (id: ${user.id})`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
