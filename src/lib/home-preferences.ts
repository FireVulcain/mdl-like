// Shared between the preferences server actions and the settings UI.

export type ExcludedTag = { id: number; name: string };

// App defaults, applied until the user saves their own list (null in DB)
export const DEFAULT_EXCLUDED_TAGS: ExcludedTag[] = [
    { id: 1045, name: "LGBTQ+" },
    { id: 14549, name: "Filmed Vertically" },
    { id: 18003, name: "Short Length Series" },
];
