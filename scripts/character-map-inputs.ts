/**
 * Gathers everything a relationship chart is read from, for one MDL entry,
 * into one text file — so that writing the chart is a reading job, not a
 * fetching job.
 *
 *   npx tsx scripts/character-map-inputs.ts <mdl-slug> [--ko "위키 제목"] [--zh "维基标题"] [--en "Wikipedia title"]
 *
 * Writes prisma/character-maps/inputs/<slug>.txt with:
 *   - the MDL cast (main, support, guest) with the [bracket] notes MDL keeps
 *     on roles — "[Ae Sun's mother]" — which already carry many family links
 *   - the MDL synopsis
 *   - the character section of each Wikipedia article found (ko for Korean
 *     dramas, zh + en for Chinese ones; en often adds what zh lacks)
 *
 * Wikipedia articles are searched by native title and year unless a title
 * is given. When a search picks the wrong article, pass the title by hand.
 *
 * The chart itself is then written by hand (or, one day, by a model) into
 * prisma/character-maps/<slug>.json — the format is described in
 * prisma/character-maps/README.md — and loaded with
 * `npm run db:seed-character-maps`.
 */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const KURYANA = process.env.KURYANA_URL ?? "https://mdl.dramatrackr.fr";
const UA = "trackr/character-map-inputs";

type CastMember = { name: string; role: { name: string }; profile_image?: string };

async function json<T>(url: string): Promise<T | null> {
    try {
        const res = await fetch(url, { headers: { "User-Agent": UA } });
        return res.ok ? ((await res.json()) as T) : null;
    } catch {
        return null;
    }
}

/** Light cleanup of wikitext: refs, templates, links, table furniture. */
function cleanWikitext(text: string): string {
    return text
        .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, "")
        .replace(/\{\{[^{}]*\}\}/g, "")
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
        .replace(/'{2,}/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/^\|-.*$|^\{\|.*$|^\|\}$|^!.*$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/**
 * The level-2 section whose heading carries one of the words, with all its
 * subsections. A contains-match, not an exact one: zh articles head the
 * section 演員陣容, 演员阵容, 演員阵容, 角色介紹, 主要演員… and every new
 * drama brings a spelling, but each has 演員/演员/角色/人物 in it.
 */
function characterSection(wikitext: string, headings: string[]): string | null {
    const re = new RegExp(`^==\\s*[^=]*(${headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})[^=]*==.*$`, "m");
    const m = re.exec(wikitext);
    if (!m) return null;
    const rest = wikitext.slice(m.index + m[0].length);
    // .*$ and not \s*$: a heading may carry an HTML comment after its ==
    const next = /^==[^=].*==.*$/m.exec(rest);
    return rest.slice(0, next ? next.index : undefined);
}

async function wikipedia(lang: string, title: string | undefined, query: string): Promise<{ title: string; text: string } | null> {
    const api = (params: Record<string, string>) =>
        json<Record<string, unknown>>(`https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ ...params, format: "json" }));
    let page = title;
    if (!page) {
        const r = (await api({ action: "query", list: "search", srsearch: query, srlimit: "3" })) as { query?: { search?: { title: string }[] } } | null;
        page = r?.query?.search?.[0]?.title;
    }
    if (!page) return null;
    const r = (await api({ action: "parse", page, prop: "wikitext" })) as { parse?: { wikitext?: { "*": string } } } | null;
    const wikitext = r?.parse?.wikitext?.["*"];
    if (!wikitext) return null;
    // A big drama gets its own characters article ("재벌집 막내아들의 등장인물",
    // "List of X characters"): every level-2 heading there is a household, so
    // the article is the section.
    const wholeArticle = /등장인물$|^List of .* characters$|角色列表$/.test(page);
    const section = wholeArticle
        ? wikitext.slice(wikitext.search(/^==[^=]/m))
        : characterSection(wikitext, ["등장 인물", "등장인물", "演員", "演员", "角色", "人物", "Cast"]);
    return section ? { title: page, text: cleanWikitext(section) } : { title: page, text: "(no character section found — headings: " + [...wikitext.matchAll(/^==([^=].*?)==/gm)].map((x) => x[1].trim()).join(", ") + ")" };
}

async function main() {
    const [slug, ...rest] = process.argv.slice(2);
    if (!slug) {
        console.error("usage: npx tsx scripts/character-map-inputs.ts <mdl-slug> [--ko title] [--zh title] [--en title]");
        process.exit(1);
    }
    const given: Record<string, string> = {};
    for (let i = 0; i < rest.length; i += 2) if (rest[i]?.startsWith("--")) given[rest[i].slice(2)] = rest[i + 1];

    const details = await json<{ data: { title: string; sub_title?: string; synopsis?: string; details?: { country?: string } } }>(`${KURYANA}/id/${slug}`);
    const cast = await json<{ data: { casts: Record<string, CastMember[]> } }>(`${KURYANA}/id/${slug}/cast`);
    if (!details?.data || !cast?.data) {
        console.error(`could not read ${slug} from the scraper`);
        process.exit(1);
    }
    const d = details.data;
    const native = d.sub_title?.split(" ‧ ")[0]?.trim() ?? "";
    const year = d.title.match(/\((\d{4})\)/)?.[1] ?? "";
    const country = d.details?.country ?? "";

    const out: string[] = [];
    out.push(`TITLE: ${d.title}`, `NATIVE: ${native}`, `COUNTRY: ${country}`, "", `SYNOPSIS:`, d.synopsis ?? "", "", "CAST:");
    for (const role of ["Main Role", "Support Role", "Guest Role"]) {
        for (const m of cast.data.casts[role] ?? []) out.push(`- [${role}] ${m.name} as ${m.role.name} | img=${m.profile_image ?? ""}`);
    }

    // Korean dramas: ko; Chinese: zh then en. Anything else: en. A given title wins.
    const wants: [string, string][] = country.includes("Korea") ? [["ko", `${native} 드라마`], ["en", `${d.title.replace(/ \(\d{4}\)$/, "")} Korean drama`]]
        : country.includes("China") ? [["zh", `${native} 电视剧`], ["en", `${d.title.replace(/ \(\d{4}\)$/, "")} Chinese drama`]]
        : [["en", d.title.replace(/ \(\d{4}\)$/, "")]];
    for (const [lang, query] of wants) {
        const w = await wikipedia(lang, given[lang], query);
        out.push("", `=== ${lang}.wikipedia${w ? ` · ${w.title}` : ""} ===`, w ? w.text : "(nothing found)");
    }

    const dir = path.join(process.cwd(), "prisma", "character-maps", "inputs");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug}.txt`);
    fs.writeFileSync(file, out.join("\n") + "\n", "utf-8");
    const main = (cast.data.casts["Main Role"] ?? []).length, support = (cast.data.casts["Support Role"] ?? []).length, guest = (cast.data.casts["Guest Role"] ?? []).length;
    console.log(`${file}\n${d.title} · cast ${main} main, ${support} support, ${guest} guest · ${year} ${country}`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
