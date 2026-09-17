/**
 * Loads one drama's episode recaps into CharacterMapRecap — the JSON array
 * the console snippet in prisma/character-maps/README.md writes, for when
 * the extension could not read Dramabeans (Cloudflare had a bad day) and
 * the recaps were saved by hand. Replaces what is kept for the slug.
 *
 *   npx tsx scripts/seed-character-map-recaps.ts <mdlSlug> <file.json>
 *
 * Each item: { title, from, to?, text, url? }. The recaps are not in git —
 * they are Dramabeans' text — only the row keeps them.
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Item = { title?: string; url?: string; from: number; to?: number; text: string };

async function main() {
    const [mdlSlug, file] = process.argv.slice(2);
    if (!mdlSlug || !file) throw new Error("usage: seed-character-map-recaps <mdlSlug> <file.json>");
    const items = JSON.parse(fs.readFileSync(file, "utf-8")) as Item[];
    const rows = items
        .filter((r) => Number.isInteger(r.from) && typeof r.text === "string" && r.text.trim())
        .map((r) => ({
            mdlSlug,
            source: "dramabeans",
            title: (r.title ?? "").slice(0, 200),
            url: r.url?.trim() || `pasted#ep${r.from}-${r.to ?? r.from}`,
            fromEp: r.from,
            toEp: Number.isInteger(r.to) ? (r.to as number) : r.from,
            words: r.text.trim().split(/\s+/).length,
            text: r.text.trim(),
        }));
    await prisma.$transaction([prisma.characterMapRecap.deleteMany({ where: { mdlSlug } }), prisma.characterMapRecap.createMany({ data: rows })]);
    const words = rows.reduce((t, r) => t + r.words, 0);
    console.log(`${mdlSlug}: ${rows.length} recaps, ep ${Math.min(...rows.map((r) => r.fromEp))}–${Math.max(...rows.map((r) => r.toEp))}, ${words} words`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
