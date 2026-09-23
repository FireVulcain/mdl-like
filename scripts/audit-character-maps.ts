/**
 * Runs the generator's link checks over every chart file, and says what
 * they find — it writes nothing, neither the files nor the rows. A link the
 * bracket check would turn round is listed as such, to be turned by hand
 * in the relationships editor or in the file (then `seed-character-map.ts`).
 *
 *   npx tsx scripts/audit-character-maps.ts [slug…]
 */
import * as fs from "fs";
import * as path from "path";
import type { CharacterMapData } from "../src/lib/character-map";

async function main() {
    const args = process.argv.slice(2);
    const only = args.filter((a) => !a.startsWith("--"));
    const { turnBrackets, unnamedEnds, pastActTies } = await import("../src/lib/character-map-checks");

    const dir = path.join("prisma", "character-maps");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "wiki-titles.json" && (only.length === 0 || only.includes(f.replace(/\.json$/, ""))));
    const totals = { charts: 0, flagged: 0, turned: 0, unnamed: 0, pastAct: 0 };
    for (const file of files.sort()) {
        const map = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as CharacterMapData;
        if (!Array.isArray(map.links) || !Array.isArray(map.people)) continue;
        totals.charts++;
        // a copy: the bracket check turns links in place
        const links = structuredClone(map.links);
        const found = {
            // "turned round" here means it would be: nothing is written
            turned: turnBrackets(links, map.people),
            unnamed: unnamedEnds(map.links, map.people),
            pastAct: pastActTies(map.links),
        };
        const count = Object.values(found).reduce((t, l) => t + l.length, 0);
        if (count === 0) continue;
        totals.flagged++;
        totals.turned += found.turned.length;
        totals.unnamed += found.unnamed.length;
        totals.pastAct += found.pastAct.length;
        console.log(`\n## ${map.mdlSlug} — ${map.title}`);
        for (const [kind, list] of Object.entries(found)) for (const w of list) console.log(`- [${kind}] ${w}`);
    }
    console.log(`\n${totals.charts} charts, ${totals.flagged} with something to look at: ${totals.turned} the wrong way round, ${totals.unnamed} sentences that miss a name, ${totals.pastAct} past acts written as ties`);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
