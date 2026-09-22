/**
 * Carries a chart from version 1 to version 2: its links sorted into ties
 * and moments. Before the distinction, a moment was written as a tie of one
 * episode ("since 6, until 6") — the README's old rule — so that is the
 * rule read back: every such tie becomes `"kind": "event"` and loses its
 * `until`. Nothing else moves; a one-episode tie that really is a tie (rare)
 * is put back by hand in the editor.
 *
 *   npx tsx scripts/reclassify-character-map.ts <mdlSlug>          report only
 *   npx tsx scripts/reclassify-character-map.ts <mdlSlug> --write  write the file and the row
 *
 * The report lists what would move and, for the eye, every remaining tie
 * whose label reads like an act (a verb in the short) — those are the ones
 * to look at in the editor afterwards, since the rule cannot tell "married"
 * from "shot him" when both were written open.
 */
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env" });

type Link = { from: string; to: string; kind?: string; type: string; short: string; label: string; since?: number | null; until?: number | null; [k: string]: unknown };
type Chart = { version: number; mdlSlug: string; people: { id: string }[]; links: Link[]; recaps?: { episodes: number }; [k: string]: unknown };

const ACT = /^(saved|shot|killed|kissed|slapped|attacked|attacks|rescued|forced|kidnapped|betrayed|confessed|proposed|beat|fought|forged|sacrificed|exposed|fired|hid|found|met|meets|helps|helped|threatens|threatened)\b/i;

async function main() {
    const args = process.argv.slice(2);
    const write = args.includes("--write");
    const slug = args.find((a) => !a.startsWith("--"));
    if (!slug) throw new Error("usage: reclassify-character-map <mdlSlug> [--write]");
    const file = path.join(process.cwd(), "prisma", "character-maps", `${slug}.json`);
    const chart = JSON.parse(fs.readFileSync(file, "utf-8")) as Chart;
    if (chart.mdlSlug !== slug) throw new Error("not a chart for that slug");
    if (chart.version === 2) {
        console.log(`${slug}: already version 2 (${chart.links.filter((l) => l.kind === "event").length} moments)`);
        return;
    }
    if (!chart.recaps) {
        console.log(`${slug}: no recaps, every link is a tie — version 2 with no moments`);
    }

    const moved: Link[] = [];
    const doubtful: Link[] = [];
    const links = chart.links.map((l) => {
        if (l.since != null && l.until != null && l.until === l.since) {
            const { until: _until, ...rest } = l;
            void _until;
            const next: Link = { from: rest.from, to: rest.to, kind: "event", ...rest };
            moved.push(next);
            return next;
        }
        if (ACT.test(l.short) || ACT.test(l.label)) doubtful.push(l);
        return l;
    });

    console.log(`${slug}: ${chart.links.length} links — ${moved.length} become moments`);
    for (const l of moved) console.log(`  moment  ep ${l.since}  ${l.from} → ${l.to}  "${l.short}"`);
    if (doubtful.length) {
        console.log(`\n${doubtful.length} ties whose words read like an act — look at these in the editor:`);
        for (const l of doubtful) console.log(`  tie  ${l.since ?? "-"}–${l.until ?? "∞"}  ${l.from} → ${l.to}  "${l.short}" — ${l.label}`);
    }
    if (!write) {
        console.log("\n(report only — add --write to save)");
        return;
    }

    // version first, then the rest in the file's order
    const next = Object.fromEntries(Object.entries({ ...chart, version: 2, links }).sort(([a], [b]) => (a === "version" ? -1 : b === "version" ? 1 : 0)));
    fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n", "utf-8");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    try {
        await prisma.characterMap.upsert({
            where: { mdlSlug: slug },
            create: { mdlSlug: slug, dataJson: next as never, source: "session" },
            update: { dataJson: next as never },
        });
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
    console.log(`\nwritten: ${path.relative(process.cwd(), file)} and the row`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
