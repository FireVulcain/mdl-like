/**
 * Runs the generator on a chart without saving it — to measure a change to
 * the pipeline before it reaches a row. The chart the run writes goes to a
 * scratch folder, beside the one in git, and the run prints what each pass
 * cost, how much of the output was thinking, and what the checks still
 * find, next to the same counts for the committed chart.
 *
 *   npx tsx scripts/eval-character-map.ts <mdlSlug> [--effort=low|medium|high] [--no-review] [--model=sonnet|opus] [--out=dir]
 *   npx tsx scripts/eval-character-map.ts <mdlSlug> --offline
 *
 * `--offline` spends nothing: it takes the committed chart through the code
 * half of the pipeline (the whole story, the layout, the budgets) and says
 * what that changes. Needs DATABASE_URL (the recaps kept for the slug) and,
 * without --offline, ANTHROPIC_API_KEY. Never writes the row nor the file.
 */
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

dotenv.config({ path: ".env", quiet: true });
dotenv.config({ path: ".env.local", quiet: true });

type Counts = { people: number; ties: number; moments: number; whole: number; warnings: number };

async function main() {
    const args = process.argv.slice(2);
    const slug = args.find((a) => !a.startsWith("--"));
    if (!slug) throw new Error("usage: eval-character-map <mdlSlug> [--effort=low] [--no-review] [--offline] [--out=dir]");
    const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
    const offline = args.includes("--offline");
    const review = !args.includes("--no-review");
    const effort = (opt("effort") ?? "medium") as "low" | "medium" | "high";
    const model = (opt("model") ?? "sonnet") as "sonnet" | "opus";
    const out = opt("out") ?? path.join(os.tmpdir(), "character-map-eval");

    const { isEvent, inWholeStory } = await import("@/lib/character-map");
    const { densityWarnings, settleWholeStory } = await import("@/lib/character-map-rules");
    const { defaultCompact } = await import("@/lib/character-map-layout");
    const { directionSentences } = await import("@/lib/character-map-review");
    type Map = import("@/lib/character-map").CharacterMapData;

    const counts = (m: Map, warnings: number): Counts => {
        const ties = m.links.filter((l) => !isEvent(l));
        return { people: m.people.length, ties: ties.length, moments: m.links.length - ties.length, whole: ties.filter(inWholeStory).length, warnings };
    };
    const line = (label: string, c: Counts) => `${label.padEnd(12)} ${c.people} people, ${c.ties} ties (${c.whole} in the whole story), ${c.moments} moments, ${c.warnings} density warnings`;

    const file = path.join(process.cwd(), "prisma", "character-maps", `${slug}.json`);
    const committed = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf-8")) as Map) : null;
    if (committed) console.log(line("committed", counts(committed, densityWarnings(committed).length)));

    if (offline) {
        if (!committed) throw new Error(`no committed chart for ${slug}`);
        const settled = settleWholeStory(committed);
        const next: Map = { ...committed, links: settled.links };
        const density = densityWarnings(next);
        console.log(line("re-settled", counts(next, density.length)));
        for (const w of [...settled.warnings, ...density]) console.log(`  ${w}`);
        const layout = defaultCompact(committed);
        console.log(`\nlayout the code would give: center ${(layout.center ?? []).join(", ")}; ${layout.people.length} in the compact cut (committed: ${committed.compact.people.length})`);
        for (const [g, cell] of Object.entries(layout.blocks)) console.log(`  ${g} [${cell}]${committed.compact.blocks[g] ? ` (committed [${committed.compact.blocks[g]}])` : ""}`);
        console.log("\ndirected ties, read back:");
        for (const s of directionSentences(committed)) console.log(`  ${s}`);
        return;
    }

    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set — put it in .env or the shell, or use --offline");
    const { gatherChartInputs } = await import("@/lib/character-map-inputs");
    const { generateChart } = await import("@/lib/character-map-generate");
    const { passLine } = await import("@/lib/character-map-review");
    const { listRecaps, recapsProblem } = await import("@/lib/character-map-recaps");
    const { GENERATOR_MODELS } = await import("@/lib/character-map-models");
    const { prisma } = await import("@/lib/prisma");
    const say = (step: string) => process.stderr.write(`  ${step}\n`);
    try {
        const recaps = await listRecaps(slug);
        const problem = recaps.length ? recapsProblem(recaps) : null;
        if (problem) throw new Error(problem);
        const inputs = await gatherChartInputs(slug, {}, say, recaps);
        const began = Date.now();
        const result = await generateChart(inputs, model, say, { effort, review });
        const minutes = ((Date.now() - began) / 60000).toFixed(1);
        const price = GENERATOR_MODELS[model];
        const usd = (u: { inputTokens: number; outputTokens: number; cacheRead: number }) => (u.inputTokens * price.input + u.cacheRead * price.cacheRead + u.outputTokens * price.output) / 1_000_000;

        fs.mkdirSync(out, { recursive: true });
        const written = path.join(out, `${slug}.${effort}${review ? "" : ".noreview"}.json`);
        fs.writeFileSync(written, JSON.stringify(result.map, null, 2) + "\n", "utf-8");

        const density = densityWarnings(result.map);
        console.log(line("this run", counts(result.map, density.length)));
        console.log(`\n${model}, effort ${effort}${review ? ", with review" : ", no review"} — ${minutes} min, $${usd(result.usage).toFixed(2)} in all`);
        for (const p of result.passes) console.log(`  ${passLine(p)} — $${usd(p.usage).toFixed(2)}`);
        const reviewed = result.warnings.filter((w) => w.includes("— reviewed"));
        if (reviewed.length) {
            console.log(`\nthe review changed ${reviewed.length}:`);
            for (const w of reviewed) console.log(`  ${w}`);
        }
        console.log(`\nleft to look at (${density.length}):`);
        for (const w of density) console.log(`  ${w}`);
        console.log(`\nwritten: ${written} (not the row, not prisma/character-maps)`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
