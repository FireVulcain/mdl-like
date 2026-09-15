/**
 * Loads every chart in prisma/character-maps/ into CharacterMap, keyed by the
 * MDL slug the file is named after. Re-runnable: an existing row is replaced.
 *
 *   npm run db:seed-character-maps
 *
 * The npm script runs pull-character-maps first: a chart Claude wrote from
 * the media page lives in its row, and without the pull this would put an
 * older file back over it. A row keeps its source ("claude", "session") when
 * it already exists — who first wrote the chart stays readable.
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
    // wiki-titles.json lives in the same folder and is not a chart
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "wiki-titles.json");
    for (const file of files) {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
        if (!Array.isArray(data.people)) continue;
        const mdlSlug = data.mdlSlug ?? file.replace(/\.json$/, "");
        await prisma.characterMap.upsert({
            where: { mdlSlug },
            create: { mdlSlug, dataJson: data, source: "session" },
            update: { dataJson: data },
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
