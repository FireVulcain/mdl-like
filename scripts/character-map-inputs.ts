/**
 * Gathers everything a relationship chart is read from, for one MDL entry,
 * into one text file — so that writing the chart is a reading job, not a
 * fetching job.
 *
 *   npx tsx scripts/character-map-inputs.ts <mdl-slug> [--ko "위키 제목"] [--zh "维基标题"] [--en "Wikipedia title"] [--recaps]
 *
 * Writes prisma/character-maps/inputs/<slug>.txt. The reading itself lives
 * in src/lib/character-map-inputs.ts, shared with the generator behind the
 * media page's admin button; a title passed here wins over the pinned one in
 * prisma/character-maps/wiki-titles.json — record it there so the next
 * machine (or the next run) does not search again. `--recaps` appends the
 * episode recaps the extension kept for the entry, in episode order, the
 * way the generator reads them — for a chart written by hand with dated links.
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

async function main() {
    const [slug, ...rest] = process.argv.slice(2);
    if (!slug) {
        console.error("usage: npx tsx scripts/character-map-inputs.ts <mdl-slug> [--ko title] [--zh title] [--en title]");
        process.exit(1);
    }
    const withRecaps = rest.includes("--recaps");
    const flags = rest.filter((a) => a !== "--recaps");
    const given: Record<string, string> = {};
    for (let i = 0; i < flags.length; i += 2) if (flags[i]?.startsWith("--")) given[flags[i].slice(2)] = flags[i + 1];

    // Imported after dotenv so KURYANA_URL and DATABASE_URL are read from .env
    const { gatherChartInputs } = await import("../src/lib/character-map-inputs");
    const recaps = withRecaps ? await (await import("../src/lib/character-map-recaps")).listRecaps(slug) : [];
    const inputs = await gatherChartInputs(slug, given, undefined, recaps);

    const dir = path.join(process.cwd(), "prisma", "character-maps", "inputs");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug}.txt`);
    fs.writeFileSync(file, inputs.text, "utf-8");
    const { main: m, support: s, guest: g } = inputs.cast;
    console.log(`${file}\n${inputs.title} · cast ${m.length} main, ${s.length} support, ${g.length} guest · ${inputs.year ?? ""} ${inputs.country}${withRecaps ? ` · ${recaps.length} recaps` : ""}`);
    // the pool behind the recaps would otherwise keep the process alive
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
