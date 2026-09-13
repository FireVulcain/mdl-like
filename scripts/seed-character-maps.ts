/**
 * Loads every chart in prisma/character-maps/ into CharacterMap, keyed by the
 * MDL slug the file is named after. Re-runnable: an existing row is replaced.
 *
 *   npm run db:seed-character-maps
 *
 * These files are the hand-read charts from the extraction trial. When a model
 * writes them instead, it writes rows directly and this script has nothing
 * left to do.
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
    const dir = path.join(process.cwd(), "prisma", "character-maps");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
        const mdlSlug = data.mdlSlug ?? file.replace(/\.json$/, "");
        await prisma.characterMap.upsert({
            where: { mdlSlug },
            create: { mdlSlug, dataJson: data, source: "session" },
            update: { dataJson: data, source: "session" },
        });
        console.log(`${mdlSlug}: ${data.people.length} people, ${data.links.length} links`);
    }
    console.log(`${files.length} chart${files.length === 1 ? "" : "s"} loaded`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
