/**
 * scripts/warm-cache.ts
 *
 * Pre-warms the Kuryana/MDL caches for every item in the watchlist and for
 * the cast members that appear in the matched MDL entries.
 *
 * Phase 1 — MDL metadata + cast
 *   • Reads all UserMedia rows from the DB
 *   • Skips items that already have a fresh CachedMdlData entry (< 7 days old)
 *   • For each uncached item: searches Kuryana (native + English title in parallel),
 *     fetches details + cast, upserts CachedMdlData
 *
 * Phase 2 — person profiles
 *   • Collects all unique Main/Support cast slugs from ALL CachedMdlData rows
 *   • Skips slugs that already have a fresh CachedKuryanaPerson entry
 *   • Fetches kuryanaGetPerson for each slug and upserts CachedKuryanaPerson
 *
 * Rate limiting: BATCH_SIZE concurrent requests per round, BATCH_DELAY_MS pause
 * between rounds.  Adjust these constants at the top of the file if needed.
 *
 * Usage:
 *   npx tsx scripts/warm-cache.ts
 *   npx tsx scripts/warm-cache.ts --phase1-only
 *   npx tsx scripts/warm-cache.ts --phase2-only
 */

import * as dotenv from "dotenv";
// Try .env.local first (Next.js convention), then fall back to .env
dotenv.config({ path: ".env.local" });
dotenv.config(); // fills anything not already set from .env

import { PrismaClient, Prisma } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
    kuryanaSearch,
    kuryanaGetDetails,
    kuryanaGetCast,
    kuryanaGetPerson,
    type KuryanaDrama,
    type KuryanaCastMember,
} from "../src/lib/kuryana";

// ─── Configuration ────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — mirrors getMdlData
const BATCH_SIZE = 3;       // concurrent Kuryana calls per round
const BATCH_DELAY_MS = 900; // pause between rounds (ms)

// ─── DB setup (mirrors src/lib/prisma.ts) ─────────────────────────────────────

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms));
}

/** Run fn on every item in batches of batchSize, sleeping delayMs between rounds. */
async function processBatches<T>(
    items: T[],
    batchSize: number,
    delayMs: number,
    fn: (item: T, globalIndex: number) => Promise<void>,
): Promise<void> {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map((item, j) => fn(item, i + j)));
        if (i + batchSize < items.length) await sleep(delayMs);
    }
}

// ─── MDL search logic (mirrors src/lib/mdl-data.ts, no React cache()) ─────────

interface MdlCastMember {
    name: string;
    profileImage: string;
    slug: string;
    characterName: string;
    roleType: "Main Role" | "Support Role" | "Guest Role";
}
interface MdlCast {
    main: MdlCastMember[];
    support: MdlCastMember[];
    guest: MdlCastMember[];
}

function normalizeTitle(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9\u0080-\uffff]/g, "");
}

function sanitizeForSearch(s: string): string {
    return s.replace(/^[^a-zA-Z0-9\u0080-\uffff]+/, "").trim();
}

function bestYearMatch(
    dramas: KuryanaDrama[],
    targetYear: number,
    queries: string[],
): KuryanaDrama | null {
    const byYear = dramas.filter((d) => d.year === targetYear);
    const byYearFuzzy = dramas.filter((d) => Math.abs(d.year - targetYear) <= 1);
    const candidates = byYear.length ? byYear : byYearFuzzy;
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const normQueries = queries.map(normalizeTitle).filter(Boolean);
    for (const q of normQueries) {
        const exact = candidates.find((d) => normalizeTitle(d.title) === q);
        if (exact) return exact;
    }
    for (const q of normQueries) {
        const partial = candidates.find((d) => {
            const dt = normalizeTitle(d.title);
            return dt.includes(q) || q.includes(dt);
        });
        if (partial) return partial;
    }
    return candidates[0];
}

function normalizeCast(members: KuryanaCastMember[]): MdlCastMember[] {
    return members.map((m) => ({
        name: m.name,
        profileImage: m.profile_image ?? "",
        slug: m.slug,
        characterName: m.role?.name ?? "",
        roleType: m.role?.type ?? "Support Role",
    }));
}

/** Fetch MDL data for one show — same logic as getMdlData() but no React cache(). */
async function fetchMdlData(
    title: string,
    year: string,
    nativeTitle?: string,
): Promise<{
    mdlSlug: string;
    mdlRating: number | null;
    mdlRanking: number | null;
    mdlPopularity: number | null;
    tags: string[];
    cast: MdlCast | null;
} | null> {
    const targetYear = parseInt(year);
    if (isNaN(targetYear)) return null;

    const queries = [nativeTitle, title].filter(Boolean) as string[];
    const searchNative = nativeTitle ? sanitizeForSearch(nativeTitle) : null;
    const searchEnglish = sanitizeForSearch(title) || title;

    const [nativeResults, englishResults] = await Promise.all([
        searchNative ? kuryanaSearch(searchNative) : Promise.resolve(null),
        kuryanaSearch(searchEnglish),
    ]);

    const seen = new Set<string>();
    const dramas: KuryanaDrama[] = [];
    for (const d of [
        ...(nativeResults?.results?.dramas ?? []),
        ...(englishResults?.results?.dramas ?? []),
    ]) {
        if (!seen.has(d.slug)) {
            seen.add(d.slug);
            dramas.push(d);
        }
    }

    const match = bestYearMatch(dramas, targetYear, queries);
    if (!match) return null;

    const [details, castResult] = await Promise.all([
        kuryanaGetDetails(match.slug),
        kuryanaGetCast(match.slug),
    ]);

    if (!details?.data) return null;

    const ranked = details.data.details?.ranked;
    const popularity = details.data.details?.popularity;
    const mdlRating =
        details.data.rating != null ? parseFloat(String(details.data.rating)) || null : null;
    const mdlRanking = ranked ? parseInt(ranked.replace("#", "")) : null;
    const mdlPopularity = popularity ? parseInt(popularity.replace("#", "")) : null;
    const tags = details.data.others?.tags ?? [];

    const cast: MdlCast | null = castResult?.data?.casts
        ? {
              main: normalizeCast(castResult.data.casts["Main Role"] ?? []),
              support: normalizeCast(castResult.data.casts["Support Role"] ?? []),
              guest: normalizeCast(castResult.data.casts["Guest Role"] ?? []),
          }
        : null;

    return { mdlSlug: match.slug, mdlRating, mdlRanking, mdlPopularity, tags, cast };
}

/** Fetch original title from TMDB for better Kuryana search accuracy. */
async function fetchNativeTitle(
    numericId: string,
    mediaType: string,
): Promise<string | undefined> {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) return undefined;
    const type = mediaType === "movie" ? "movie" : "tv";
    try {
        const res = await fetch(
            `https://api.themoviedb.org/3/${type}/${numericId}?api_key=${apiKey}&language=en-US`,
        );
        if (!res.ok) return undefined;
        const d = (await res.json()) as { original_title?: string; original_name?: string };
        return d.original_title || d.original_name || undefined;
    } catch {
        return undefined;
    }
}

// ─── Phase 1: MDL data ─────────────────────────────────────────────────────────

interface MediaRow {
    externalId: string;
    title: string | null;
    year: number | null;
    mediaType: string;
}

async function phase1(rows: MediaRow[]): Promise<Set<string>> {
    const allCastSlugs = new Set<string>();
    let ok = 0;
    let failed = 0;
    const total = rows.length;

    await processBatches(rows, BATCH_SIZE, BATCH_DELAY_MS, async (row, i) => {
        const title = row.title ?? "Unknown";
        const year = String(row.year ?? 0);
        const numericId = row.externalId.replace(/^tmdb-/, "");
        console.log(`  [${i + 1}/${total}] ${title} (${year})`);

        try {
            // Fetch native title from TMDB for better search accuracy
            const nativeTitle = await fetchNativeTitle(numericId, row.mediaType);

            const data = await fetchMdlData(title, year, nativeTitle);
            if (!data) {
                console.log(`    ✗ No MDL match`);
                failed++;
                return;
            }

            await prisma.cachedMdlData.upsert({
                where: { tmdbExternalId: row.externalId },
                create: {
                    tmdbExternalId: row.externalId,
                    mdlSlug: data.mdlSlug,
                    mdlRating: data.mdlRating,
                    mdlRanking: data.mdlRanking,
                    mdlPopularity: data.mdlPopularity,
                    tags: data.tags,
                    castJson: data.cast as unknown as Prisma.InputJsonValue,
                },
                update: {
                    mdlSlug: data.mdlSlug,
                    mdlRating: data.mdlRating,
                    mdlRanking: data.mdlRanking,
                    mdlPopularity: data.mdlPopularity,
                    tags: data.tags,
                    castJson: data.cast as unknown as Prisma.InputJsonValue,
                    cachedAt: new Date(),
                },
            });

            const castCount =
                (data.cast?.main.length ?? 0) + (data.cast?.support.length ?? 0);
            console.log(
                `    ✓ ${data.mdlSlug}  rating=${data.mdlRating ?? "—"}  cast=${castCount}`,
            );

            // Collect Main + Support slugs for phase 2 (skip Guest, too peripheral)
            if (data.cast) {
                for (const m of [...data.cast.main, ...data.cast.support]) {
                    if (m.slug) allCastSlugs.add(m.slug);
                }
            }
            ok++;
        } catch (e) {
            console.error(`    ✗ Error: ${e instanceof Error ? e.message : e}`);
            failed++;
        }
    });

    console.log(`\n  Phase 1 complete — ${ok} cached, ${failed} failed\n`);
    return allCastSlugs;
}

// ─── Phase 2: person profiles ──────────────────────────────────────────────────

async function phase2(slugs: string[]): Promise<void> {
    let ok = 0;
    let failed = 0;
    const total = slugs.length;

    await processBatches(slugs, BATCH_SIZE, BATCH_DELAY_MS, async (slug, i) => {
        console.log(`  [${i + 1}/${total}] ${slug}`);
        try {
            const result = await kuryanaGetPerson(slug);
            if (!result?.data) {
                console.log(`    ✗ Not found`);
                failed++;
                return;
            }

            await prisma.cachedKuryanaPerson.upsert({
                where: { slug },
                create: {
                    slug,
                    dataJson: result.data as unknown as Prisma.InputJsonValue,
                },
                update: {
                    dataJson: result.data as unknown as Prisma.InputJsonValue,
                    cachedAt: new Date(),
                },
            });

            console.log(`    ✓ ${result.data.name}`);
            ok++;
        } catch (e) {
            console.error(`    ✗ Error: ${e instanceof Error ? e.message : e}`);
            failed++;
        }
    });

    console.log(`\n  Phase 2 complete — ${ok} cached, ${failed} failed\n`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const phase1Only = args.includes("--phase1-only");
    const phase2Only = args.includes("--phase2-only");
    const runPhase1 = !phase2Only;
    const runPhase2 = !phase1Only;

    console.log("🔥  Kuryana cache warmer\n");

    // ── Fetch watchlist ────────────────────────────────────────────────────────
    const allMedia = await prisma.userMedia.findMany({
        where: { source: "tmdb" },
        select: { externalId: true, title: true, year: true, mediaType: true },
        distinct: ["externalId"],
    });

    const staleAt = new Date(Date.now() - CACHE_TTL_MS);

    // ── Phase 1 ────────────────────────────────────────────────────────────────
    let newSlugsFromPhase1 = new Set<string>();

    if (runPhase1) {
        const freshMdlIds = new Set(
            (
                await prisma.cachedMdlData.findMany({
                    where: { cachedAt: { gt: staleAt } },
                    select: { tmdbExternalId: true },
                })
            ).map((r) => r.tmdbExternalId),
        );

        const toFetch = allMedia.filter((m) => !freshMdlIds.has(m.externalId));

        console.log(
            `Watchlist: ${allMedia.length} items  |  fresh: ${freshMdlIds.size}  |  to fetch: ${toFetch.length}`,
        );

        if (toFetch.length > 0) {
            console.log("\n── Phase 1: MDL metadata + cast ─────────────────────────────\n");
            newSlugsFromPhase1 = await phase1(toFetch);
        } else {
            console.log("  All MDL data is already fresh — skipping phase 1.\n");
        }
    }

    // ── Phase 2 ────────────────────────────────────────────────────────────────
    if (runPhase2) {
        // Collect cast slugs from ALL cached MDL entries (not just new ones)
        const allCachedMdl = await prisma.cachedMdlData.findMany({
            select: { castJson: true },
        });

        const allCastSlugs = new Set<string>(newSlugsFromPhase1);
        for (const row of allCachedMdl) {
            if (row.castJson && typeof row.castJson === "object" && !Array.isArray(row.castJson)) {
                const c = row.castJson as {
                    main?: { slug: string }[];
                    support?: { slug: string }[];
                };
                for (const m of [...(c.main ?? []), ...(c.support ?? [])]) {
                    if (m.slug) allCastSlugs.add(m.slug);
                }
            }
        }

        const freshPersonSlugs = new Set(
            (
                await prisma.cachedKuryanaPerson.findMany({
                    where: { cachedAt: { gt: staleAt } },
                    select: { slug: true },
                })
            ).map((r) => r.slug),
        );

        const toFetch = [...allCastSlugs].filter((s) => !freshPersonSlugs.has(s));

        console.log(
            `Cast members: ${allCastSlugs.size} unique  |  fresh: ${freshPersonSlugs.size}  |  to fetch: ${toFetch.length}`,
        );

        if (toFetch.length > 0) {
            console.log("\n── Phase 2: person profiles ─────────────────────────────────\n");
            await phase2(toFetch);
        } else {
            console.log("  All person data is already fresh — skipping phase 2.\n");
        }
    }

    console.log("✅  Done.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
