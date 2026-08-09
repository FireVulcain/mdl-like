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
    // Section heading, and the same string in the settings section list
    title: string;
    accent: HomeAccent;
    accentBg: string; // Top Rated row dot
    accentText: string; // spotlight kicker
    airingBg: string; // Airing Now row dot
};

// One entry per Kuryana-supported country, keyed by the ISO code the /dramas
// browse page understands (its COUNTRY_MAP shares these keys).
export const UNIVERSES: Record<string, UniverseConfig> = {
    KR: {
        kuryana: "korean", title: "K-Drama Universe",
        accent: "sky", accentBg: "bg-sky-400", accentText: "text-sky-400", airingBg: "bg-emerald-400",
    },
    CN: {
        kuryana: "chinese", title: "C-Drama Universe",
        accent: "rose", accentBg: "bg-rose-400", accentText: "text-rose-400", airingBg: "bg-violet-400",
    },
    JP: {
        kuryana: "japanese", title: "J-Drama Universe",
        accent: "fuchsia", accentBg: "bg-fuchsia-400", accentText: "text-fuchsia-400", airingBg: "bg-emerald-400",
    },
    TW: {
        kuryana: "taiwanese", title: "TW-Drama Universe",
        accent: "emerald", accentBg: "bg-emerald-400", accentText: "text-emerald-400", airingBg: "bg-violet-400",
    },
    TH: {
        kuryana: "thai", title: "Thai Drama Universe",
        accent: "teal", accentBg: "bg-teal-400", accentText: "text-teal-400", airingBg: "bg-violet-400",
    },
    HK: {
        kuryana: "hongkong", title: "HK-Drama Universe",
        accent: "indigo", accentBg: "bg-indigo-400", accentText: "text-indigo-400", airingBg: "bg-emerald-400",
    },
    PH: {
        kuryana: "philippine", title: "Filipino Drama Universe",
        accent: "lime", accentBg: "bg-lime-400", accentText: "text-lime-400", airingBg: "bg-violet-400",
    },
    SG: {
        kuryana: "singaporean", title: "SG-Drama Universe",
        accent: "cyan", accentBg: "bg-cyan-400", accentText: "text-cyan-400", airingBg: "bg-emerald-400",
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
    if (id.startsWith("drama-")) return UNIVERSES[id.slice(6)]?.title ?? id;
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
