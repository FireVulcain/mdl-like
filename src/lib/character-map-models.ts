/**
 * The two models the generate button offers — no server imports, since the
 * button is a client component and reads this for its choice and its cost
 * line. Sonnet by default: the work is disciplined extraction — a cast, a
 * synopsis, an article, transcribed into links with their sentence — and
 * Sonnet does that at a fraction of the price. Opus for the big Chinese
 * casts (50 support roles, a long zh article), where holding the rules over
 * a long input is what counts. Prices are list, per million tokens.
 */
export const GENERATOR_MODELS = {
    sonnet: { id: "claude-sonnet-5", label: "Sonnet 5", input: 2, output: 10, cacheRead: 0.2 },
    opus: { id: "claude-opus-5", label: "Opus 5", input: 5, output: 25, cacheRead: 0.5 },
} as const;
export type GeneratorModel = keyof typeof GENERATOR_MODELS;
export const DEFAULT_GENERATOR_MODEL: GeneratorModel = "sonnet";
