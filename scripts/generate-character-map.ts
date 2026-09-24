/**
 * Writes a chart from the command line — the same run the admin's
 * "Generate chart" button starts, without the button: the MDL cast and
 * synopsis, the Wikipedia character sections, the recaps kept in the table
 * for the slug, one call to Claude, the checks, and the row and the file
 * written together. For carrying a chart series by series to the tie /
 * moment shape without a browser in the loop.
 *
 *   npx tsx scripts/generate-character-map.ts <mdlSlug> [--model=opus|sonnet] [--effort=low|medium|high] [--no-review] [--no-recaps] [--ko "제목"] [--en "Title"] [--zh "标题"]
 *
 * Needs DATABASE_URL and ANTHROPIC_API_KEY (from .env, or the shell). Like
 * the button's full run, it replaces the row: hand-edited links are lost,
 * the stills come back with the next visit of the page (the extension
 * writes them again).
 */
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

async function main() {
    const args = process.argv.slice(2);
    const slug = args.find((a) => !a.startsWith("--") && !/^[a-z]{2}$/.test(a) && !args[args.indexOf(a) - 1]?.startsWith("--"));
    if (!slug) throw new Error("usage: generate-character-map <mdlSlug> [--model=opus] [--no-recaps] [--ko \"제목\"]");
    const model = (args.find((a) => a.startsWith("--model="))?.slice("--model=".length) ?? "sonnet") as "sonnet" | "opus";
    const withRecaps = !args.includes("--no-recaps");
    const effort = args.find((a) => a.startsWith("--effort="))?.slice("--effort=".length) as "low" | "medium" | "high" | undefined;
    const review = !args.includes("--no-review");
    const titles: Record<string, string> = {};
    for (const lang of ["ko", "en", "zh"]) {
        const i = args.indexOf(`--${lang}`);
        if (i >= 0 && args[i + 1]) titles[lang] = args[i + 1];
    }
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set — put it in .env or the shell");

    // after dotenv: the lib's prisma client reads DATABASE_URL on import
    const { gatherChartInputs } = await import("@/lib/character-map-inputs");
    const { generateChart, saveChart } = await import("@/lib/character-map-generate");
    const { listRecaps, recapsProblem } = await import("@/lib/character-map-recaps");
    const { prisma } = await import("@/lib/prisma");

    const say = (step: string) => process.stderr.write(`  ${step}\n`);
    try {
        const recaps = withRecaps ? await listRecaps(slug) : [];
        const problem = recaps.length ? recapsProblem(recaps) : null;
        if (problem) throw new Error(problem);
        say(recaps.length ? `${recaps.length} ${recaps[0].source} recaps kept for ${slug}` : "no recaps — reading the cast and the articles alone");
        const inputs = await gatherChartInputs(slug, titles, say, recaps);
        say(`writing the chart with ${model}`);
        const result = await generateChart(inputs, model, say, { effort, review });
        const { file } = await saveChart(result.map, "claude", { editedAt: null });
        const { people, links } = result.map;
        const moments = links.filter((l) => l.kind === "event").length;
        console.log(`\n${slug}: ${people.length} people, ${links.length - moments} ties, ${moments} moments — ${result.model}, ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);
        console.log(file ? `written: ${file}` : "the file was not written; the row is the only copy");
        for (const w of result.warnings) console.log(`  warning: ${w}`);
        for (const w of inputs.wiki) if (!w.text) console.log(`  warning: ${w.lang}.wikipedia — ${w.title ? "no character section" : "no article found"}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
});
