// Shared between the preferences server actions and the settings UI.

import type { KuryanaTopCountry } from "@/lib/kuryana";
import type { HomeAccent } from "@/components/home-section-header";

export type ExcludedTag = { id: number; name: string };

// App defaults, applied until the user saves their own list (null in DB)
export const DEFAULT_EXCLUDED_TAGS: ExcludedTag[] = [
    { id: 1045, name: "LGBTQ+" },
    { id: 14549, name: "Filmed Vertically" },
    { id: 18003, name: "Short Length Series" },
];

// ─── Home sections ──────────────────────────────────────────────────────────

export type UniverseConfig = {
    kuryana: KuryanaTopCountry;
    label: string; // shown in the settings list
    eyebrow: string;
    title: string;
    subtitle: string;
    accent: HomeAccent;
    accentBg: string; // Top Rated row dot
    accentText: string; // spotlight kicker
    airingBg: string; // Airing Now row dot
    glow: string; // ambient glow position + tint
};

// One entry per Kuryana-supported country, keyed by the ISO code the /dramas
// browse page understands (its COUNTRY_MAP shares these keys).
export const UNIVERSES: Record<string, UniverseConfig> = {
    KR: {
        kuryana: "korean", label: "K-Drama Universe", eyebrow: "South Korea", title: "K-Drama Universe",
        subtitle: "Fresh from Seoul · Trending, airing, and upcoming series",
        accent: "sky", accentBg: "bg-sky-400", accentText: "text-sky-400", airingBg: "bg-emerald-400",
        glow: "right-0 bg-sky-500/6",
    },
    CN: {
        kuryana: "chinese", label: "C-Drama Universe", eyebrow: "China", title: "C-Drama Universe",
        subtitle: "Fresh from China · Trending, airing, and upcoming series",
        accent: "rose", accentBg: "bg-rose-400", accentText: "text-rose-400", airingBg: "bg-violet-400",
        glow: "left-0 bg-rose-500/6",
    },
    JP: {
        kuryana: "japanese", label: "J-Drama Universe", eyebrow: "Japan", title: "J-Drama Universe",
        subtitle: "Fresh from Tokyo · Trending, airing, and upcoming series",
        accent: "fuchsia", accentBg: "bg-fuchsia-400", accentText: "text-fuchsia-400", airingBg: "bg-emerald-400",
        glow: "right-0 bg-fuchsia-500/6",
    },
    TW: {
        kuryana: "taiwanese", label: "TW-Drama Universe", eyebrow: "Taiwan", title: "TW-Drama Universe",
        subtitle: "Fresh from Taipei · Trending, airing, and upcoming series",
        accent: "emerald", accentBg: "bg-emerald-400", accentText: "text-emerald-400", airingBg: "bg-violet-400",
        glow: "left-0 bg-emerald-500/6",
    },
    TH: {
        kuryana: "thai", label: "Thai Drama Universe", eyebrow: "Thailand", title: "Thai Drama Universe",
        subtitle: "Fresh from Bangkok · Trending, airing, and upcoming series",
        accent: "teal", accentBg: "bg-teal-400", accentText: "text-teal-400", airingBg: "bg-violet-400",
        glow: "right-0 bg-teal-500/6",
    },
    HK: {
        kuryana: "hongkong", label: "HK-Drama Universe", eyebrow: "Hong Kong", title: "HK-Drama Universe",
        subtitle: "Fresh from Hong Kong · Trending, airing, and upcoming series",
        accent: "indigo", accentBg: "bg-indigo-400", accentText: "text-indigo-400", airingBg: "bg-emerald-400",
        glow: "left-0 bg-indigo-500/6",
    },
    PH: {
        kuryana: "philippine", label: "Filipino Drama Universe", eyebrow: "Philippines", title: "Filipino Drama Universe",
        subtitle: "Fresh from Manila · Trending, airing, and upcoming series",
        accent: "lime", accentBg: "bg-lime-400", accentText: "text-lime-400", airingBg: "bg-violet-400",
        glow: "right-0 bg-lime-500/6",
    },
    SG: {
        kuryana: "singaporean", label: "SG-Drama Universe", eyebrow: "Singapore", title: "SG-Drama Universe",
        subtitle: "Fresh from Singapore · Trending, airing, and upcoming series",
        accent: "cyan", accentBg: "bg-cyan-400", accentText: "text-cyan-400", airingBg: "bg-emerald-400",
        glow: "left-0 bg-cyan-500/6",
    },
};

export type HomeSectionConfig = { id: string; enabled: boolean };

// Order matters — this is the default page layout. Universes beyond KR/CN are
// available but off by default.
export const DEFAULT_HOME_SECTIONS: HomeSectionConfig[] = [
    { id: "actor-radar", enabled: true },
    { id: "drama-KR", enabled: true },
    { id: "drama-CN", enabled: true },
    { id: "drama-JP", enabled: false },
    { id: "drama-TW", enabled: false },
    { id: "drama-TH", enabled: false },
    { id: "drama-HK", enabled: false },
    { id: "drama-PH", enabled: false },
    { id: "drama-SG", enabled: false },
    { id: "trending", enabled: true },
];

export function homeSectionLabel(id: string): string {
    if (id === "actor-radar") return "From Actors You Watch";
    if (id === "trending") return "Trending Worldwide";
    if (id.startsWith("drama-")) return UNIVERSES[id.slice(6)]?.label ?? id;
    return id;
}

// Stored lists survive app updates: unknown ids are dropped, newly added
// sections are appended with their default state.
export function normalizeHomeSections(stored: HomeSectionConfig[]): HomeSectionConfig[] {
    const known = new Set(DEFAULT_HOME_SECTIONS.map((s) => s.id));
    const kept = stored.filter((s) => known.has(s.id) && typeof s.enabled === "boolean");
    const seen = new Set(kept.map((s) => s.id));
    const appended = DEFAULT_HOME_SECTIONS.filter((s) => !seen.has(s.id));
    return [...kept, ...appended];
}
