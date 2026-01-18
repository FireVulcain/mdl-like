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
    const userId = "mock-user-1";

    // Try to find existing user by ID first (preserve existing data)
    const existingUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    let user;
    if (existingUser) {
        // Update existing user with email and password
        user = await prisma.user.update({
            where: { id: userId },
            data: {
                email,
                name: "Admin",
                password: hashedPassword,
            },
        });
        console.log(`Existing user updated with admin credentials: ${user.email}`);
    } else {
        // Create new user
        user = await prisma.user.create({
            data: {
                id: userId,
                email,
                name: "Admin",
                password: hashedPassword,
            },
        });
        console.log(`Admin user created: ${user.email}`);
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
