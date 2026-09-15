/**
 * The seed script in reverse: writes every chart in CharacterMap to
 * prisma/character-maps/<slug>.json when the file is missing or says
 * something else.
 *
 *   npm run db:pull-character-maps
 *
 * A chart the admin has Claude write from the media page lands in the row
 * (and in a file on the server's disk, not in this checkout). The seed runs
 * this first, or it would put the older file back over such a chart; and
 * `npm run dev` runs it too (--quiet: one line, and a database out of reach
 * does not stop the dev server), so a chart generated in production shows
 * up in the checkout the next time the dev server starts, and is committed
 * with whatever comes next. Charts that came from the files are untouched
 * unless the row was replaced since.
 *
 * Postgres keeps jsonb keys in its own order, so a row is compared to its
 * file with keys sorted, and written back in the README's order — a pull
 * that changed nothing leaves no diff.
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

// The order the hand-written files use; keys not listed follow, as they come
const ORDER: Record<string, string[]> = {
    "": ["version", "mdlSlug", "title", "asianwiki", "native", "year", "country", "sources", "main", "people", "links", "compact"],
    people: ["id", "name", "actor", "image", "still", "group", "inCast", "note", "alsoPlayedBy"],
    alsoPlayedBy: ["name", "image", "still", "era"],
    links: ["from", "to", "type", "label", "short", "evidence", "source", "reveal", "inferred", "directed"],
    compact: ["people", "blocks", "center"],
};

function ordered(value: unknown, key: string): unknown {
    if (Array.isArray(value)) return value.map((v) => ordered(v, key));
    if (!value || typeof value !== "object") return value;
    const obj = value as Record<string, unknown>;
    const first = ORDER[key] ?? [];
    const keys = [...first.filter((k) => k in obj), ...Object.keys(obj).filter((k) => !first.includes(k))];
    return Object.fromEntries(keys.map((k) => [k, ordered(obj[k], k)]));
}

function canonical(value: unknown): string {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (!value || typeof value !== "object") return JSON.stringify(value);
    const obj = value as Record<string, unknown>;
    return "{" + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ":" + canonical(obj[k])).join(",") + "}";
}

const quiet = process.argv.includes("--quiet");

async function main() {
    const dir = path.join(process.cwd(), "prisma", "character-maps");
    const rows = await prisma.characterMap.findMany({ select: { mdlSlug: true, dataJson: true, source: true, updatedAt: true } });
    let written = 0;
    for (const row of rows) {
        // an old seed once loaded wiki-titles.json as if it were a chart
        if (!Array.isArray((row.dataJson as { people?: unknown })?.people)) continue;
        const file = path.join(dir, `${row.mdlSlug}.json`);
        const current = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as unknown) : null;
        if (current && canonical(current) === canonical(row.dataJson)) continue;
        fs.writeFileSync(file, JSON.stringify(ordered(row.dataJson, ""), null, 2) + "\n", "utf-8");
        written++;
        const map = row.dataJson as { people?: unknown[]; links?: unknown[] };
        console.log(`${current ? "updated" : "new    "} ${row.mdlSlug}: ${map.people?.length ?? "?"} people, ${map.links?.length ?? "?"} links · ${row.source} · ${row.updatedAt.toISOString().slice(0, 10)}`);
    }
    if (written || !quiet) console.log(`${written} chart file${written === 1 ? "" : "s"} pulled from the database${written ? " — commit them with the next change" : ""}`);
}

main()
    .catch((e) => {
        if (quiet) {
            console.warn(`character maps not pulled: ${e instanceof Error ? e.message : e}`);
            return;
        }
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
