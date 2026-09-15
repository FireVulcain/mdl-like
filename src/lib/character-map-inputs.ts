import * as fs from "fs";
import * as path from "path";

/**
 * Everything a relationship chart is read from, for one MDL entry: the cast
 * with MDL's [bracket] notes, the synopsis, and the character section of the
 * Wikipedia articles found for it. One text, the same the hand-written
 * charts were read from — the generator reads it, and so does the inputs
 * script when someone wants to read it themselves.
 *
 * Wikipedia is searched by native title and year unless a title is pinned in
 * prisma/character-maps/wiki-titles.json (slug → { ko, zh, en }); a pin
 * always wins over a search, which is how the wrong article gets corrected
 * once and stays corrected.
 */
const KURYANA = process.env.KURYANA_URL ?? "https://mdl.dramatrackr.fr";
const UA = "trackr/character-map-inputs";

export type CastMember = { name: string; role: { name: string }; profile_image?: string };
/** `rejected` names the article a search found that turned out to be about something else. */
export type WikiSection = { lang: string; title: string | null; text: string | null; rejected?: string };
export type ChartInputs = {
    mdlSlug: string;
    title: string;
    native: string;
    year: number | null;
    country: string;
    synopsis: string;
    cast: { main: CastMember[]; support: CastMember[]; guest: CastMember[] };
    wiki: WikiSection[];
    /** the whole thing as one text, the way inputs/<slug>.txt is written */
    text: string;
};

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
 * section 演員陣容, 演员阵容, 角色介紹, 主要演員… and every new drama brings
 * a spelling, but each has 演員/演员/角色/人物 in it.
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

/**
 * Whether the article a search found is about this drama. The search is
 * loose — it has answered a K-drama's title with "MBC 일일 드라마", an
 * actor's page, a 2011 drama of the same name, the American series — and a
 * wrong article would hand the model another cast's character section as
 * if it were this one's. A year in the page title must be the drama's. A
 * native-language page must contain the native title, or share a word of
 * it. An English page must share a word of the title and name one of the
 * main cast, since English articles carry the romanised names MDL uses. A
 * title pinned by hand is trusted as it is.
 */
function aboutThisDrama(lang: string, page: string, wikitext: string, about: { native: string; bare: string; year: number | null; actors: string[] }): boolean {
    const fold = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const head = page.replace(/\s*\([^)]*\)\s*$/, "");
    const yearInTitle = page.match(/\((?:[^)]*\D)?((?:19|20)\d{2})\D[^)]*\)$|\(((?:19|20)\d{2})\)$/);
    const year = yearInTitle ? parseInt(yearInTitle[1] ?? yearInTitle[2]) : null;
    if (year && about.year && year !== about.year) return false;
    if (lang === "en") {
        const words = about.bare.split(/\s+/).map(fold).filter((w) => w.length >= 3 && !["the", "and", "with", "for"].includes(w));
        const titleFits = fold(head).includes(fold(about.bare)) || words.some((w) => fold(head).includes(w));
        const text = fold(wikitext);
        return titleFits && about.actors.some((a) => text.includes(fold(a)));
    }
    const native = about.native || about.bare;
    if (!native) return true;
    if (fold(head).includes(fold(native))) return true;
    const words = native.split(/\s+/).filter((w) => w.length >= 2);
    return words.some((w) => head.includes(w));
}

async function wikipedia(lang: string, title: string | undefined, query: string, about: { native: string; bare: string; year: number | null; actors: string[] }): Promise<WikiSection> {
    const api = (params: Record<string, string>) =>
        json<Record<string, unknown>>(`https://${lang}.wikipedia.org/w/api.php?` + new URLSearchParams({ ...params, format: "json" }));
    let page = title;
    if (!page) {
        const r = (await api({ action: "query", list: "search", srsearch: query, srlimit: "3" })) as { query?: { search?: { title: string }[] } } | null;
        page = r?.query?.search?.[0]?.title;
    }
    if (!page) return { lang, title: null, text: null };
    const r = (await api({ action: "parse", page, prop: "wikitext" })) as { parse?: { wikitext?: { "*": string } } } | null;
    const wikitext = r?.parse?.wikitext?.["*"];
    if (!wikitext) return { lang, title: page, text: null };
    if (!title && !aboutThisDrama(lang, page, wikitext, about)) return { lang, title: null, text: null, rejected: page };
    // A big drama gets its own characters article ("재벌집 막내아들의 등장인물",
    // "List of X characters"): every level-2 heading there is a household, so
    // the article is the section.
    const wholeArticle = /등장인물$|^List of .* characters$|角色列表$/.test(page);
    const section = wholeArticle
        ? wikitext.slice(wikitext.search(/^==[^=]/m))
        : characterSection(wikitext, ["등장 인물", "등장인물", "출연", "演員", "演员", "角色", "人物", "Cast"]);
    return { lang, title: page, text: section ? cleanWikitext(section) : null };
}

/** The pinned Wikipedia titles for a slug, from wiki-titles.json — empty when none. */
export function pinnedWikiTitles(mdlSlug: string): Record<string, string> {
    const file = path.join(process.cwd(), "prisma", "character-maps", "wiki-titles.json");
    try {
        const known = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, Record<string, string>>;
        return { ...(known[mdlSlug] ?? {}) };
    } catch {
        return {};
    }
}

/**
 * Reads everything for one entry. `titles` overrides the pinned Wikipedia
 * titles (a flag on the command line, a field in the admin form). `onStep`
 * hears each fetch as it starts, for a progress line.
 */
export async function gatherChartInputs(
    mdlSlug: string,
    titles: Record<string, string> = {},
    onStep?: (step: string) => void,
): Promise<ChartInputs> {
    const given = { ...pinnedWikiTitles(mdlSlug), ...titles };

    onStep?.("Reading the MDL entry");
    const details = await json<{ data: { title: string; sub_title?: string; synopsis?: string; details?: { country?: string } } }>(`${KURYANA}/id/${mdlSlug}`);
    const cast = await json<{ data: { casts: Record<string, CastMember[]> } }>(`${KURYANA}/id/${mdlSlug}/cast`);
    if (!details?.data || !cast?.data) throw new Error(`could not read ${mdlSlug} from the scraper`);
    const d = details.data;
    const native = d.sub_title?.split(" ‧ ")[0]?.trim() ?? "";
    const yearMatch = d.title.match(/\((\d{4})\)/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;
    const country = d.details?.country ?? "";
    const casts = { main: cast.data.casts["Main Role"] ?? [], support: cast.data.casts["Support Role"] ?? [], guest: cast.data.casts["Guest Role"] ?? [] };

    const out: string[] = [];
    out.push(`TITLE: ${d.title}`, `NATIVE: ${native}`, `COUNTRY: ${country}`, "", `SYNOPSIS:`, d.synopsis ?? "", "", "CAST:");
    for (const [role, list] of [["Main Role", casts.main], ["Support Role", casts.support], ["Guest Role", casts.guest]] as const) {
        for (const m of list) out.push(`- [${role}] ${m.name} as ${m.role.name} | img=${m.profile_image ?? ""}`);
    }

    // Korean dramas: ko; Chinese: zh then en. Anything else: en. A given title wins.
    const bare = d.title.replace(/ \(\d{4}\)$/, "");
    const wants: [string, string][] = country.includes("Korea") ? [["ko", `${native} 드라마`], ["en", `${bare} Korean drama`]]
        : country.includes("China") ? [["zh", `${native} 电视剧`], ["en", `${bare} Chinese drama`]]
        : [["en", bare]];
    const about = { native, bare, year, actors: casts.main.slice(0, 4).map((m) => m.name) };
    const wiki: WikiSection[] = [];
    for (const [lang, query] of wants) {
        onStep?.(`Reading ${lang}.wikipedia`);
        const w = await wikipedia(lang, given[lang], query, about);
        wiki.push(w);
        out.push("", `=== ${lang}.wikipedia${w.title ? ` · ${w.title}` : ""} ===`, w.text ?? (w.title ? "(no character section found)" : w.rejected ? `(search found "${w.rejected}", which is not this drama)` : "(nothing found)"));
    }

    return { mdlSlug, title: d.title, native, year, country, synopsis: d.synopsis ?? "", cast: casts, wiki, text: out.join("\n") + "\n" };
}
