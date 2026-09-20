/**
 * Loads one chart file into its CharacterMap row — the plural seed loads
 * every file after a pull, which would put the row back over a file just
 * written by hand. Replaces the row; `editedAt` is cleared, as a fresh
 * chart has no hand edits.
 *
 *   npx tsx scripts/seed-character-map.ts <mdlSlug>
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
    const slug = process.argv[2];
    if (!slug) throw new Error("usage: seed-one <mdlSlug>");
    const file = path.join(process.cwd(), "prisma", "character-maps", `${slug}.json`);
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (data.mdlSlug !== slug || !Array.isArray(data.people)) throw new Error("not a chart for that slug");
    await prisma.characterMap.upsert({
        where: { mdlSlug: slug },
        create: { mdlSlug: slug, dataJson: data, source: "session" },
        update: { dataJson: data, editedAt: null },
    });
    console.log(`${slug}: ${data.people.length} people, ${data.links.length} links, recaps ${data.recaps?.source ?? "none"} ${data.recaps?.episodes ?? ""}`);
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
