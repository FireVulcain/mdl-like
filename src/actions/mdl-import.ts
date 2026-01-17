"use server";

import puppeteer from "puppeteer";
import { ratio } from "fuzzball";
import { prisma } from "@/lib/prisma";
import type { UserMedia } from "@prisma/client";

type MDLItem = {
    title: string;
    year: string | null;
    rating: string | null;
    status: string;
    progress: string;
    notes: string | null;
};

type MatchResult = {
    mdlItem: MDLItem;
    dbItem: UserMedia;
    confidence: number;
};

/**
 * Scrape watchlist from MyDramaList
 */
async function scrapeMDLWatchlist(username: string): Promise<MDLItem[]> {
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", `--user-agent=${userAgent}`],
    });

    try {
        const page = await browser.newPage();
        const items: MDLItem[] = [];

        // Visit the watchlist page
        await page.goto(`https://mydramalist.com/dramalist/${username}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
        });

        // Wait a bit for JavaScript to load
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Try multiple possible selectors
        const possibleSelectors = [".msv2-table tbody tr", "table tbody tr", ".list-item", "[class*='table'] tr"];

        let foundSelector = null;
        for (const selector of possibleSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 3000 });
                foundSelector = selector;
                console.log(`Found elements with selector: ${selector}`);
                break;
            } catch {
                console.log(`Selector not found: ${selector}`);
            }
        }

        if (!foundSelector) {
            // Take a screenshot for debugging
            await page.screenshot({ path: "mdl-debug.png" });
            throw new Error("Could not find watchlist table. Screenshot saved to mdl-debug.png");
        }

        // Extract all items
        const scrapedItems = await page.evaluate((selector: string) => {
            const results: {
                title: string;
                year: string | null;
                rating: string | null;
                status: string;
                progress: string;
                notes: string | null;
            }[] = [];
            const rows = document.querySelectorAll(selector);

            rows.forEach((row) => {
                // Title
                const titleEl = row.querySelector(".msv2-i-title .title");
                const title = titleEl?.textContent?.trim() || "";

                // Year
                const yearEl = row.querySelector(".msv2-i-year");
                const year = yearEl?.textContent?.trim() || null;

                // MDL Score (community rating)
                const scoreEl = row.querySelector(".msv2-i-mdlscore .score");
                const rating = scoreEl?.textContent?.trim() || null;

                // Status
                const statusEl = row.querySelector(".msv2-i-status");
                const status = statusEl?.textContent?.trim() || "Plan to Watch";

                // Progress (episodes watched/total)
                const progressEl = row.querySelector(".episode-seen");
                const progress = progressEl?.textContent?.trim() || "0";

                // Notes - MDL doesn't show notes in the table view, need to check if available
                const notes = null; // Notes are not visible in table view

                if (title) {
                    results.push({
                        title,
                        year,
                        rating,
                        status,
                        progress,
                        notes,
                    });
                }
            });

            return results;
        }, foundSelector);

        items.push(...scrapedItems);
        return items;
    } finally {
        await browser.close();
    }
}

/**
 * Match MDL items with database items using fuzzy matching
 */
function matchItems(mdlItems: MDLItem[], dbItems: UserMedia[]): MatchResult[] {
    const matches: MatchResult[] = [];
    const usedDbItemIds = new Set<string>();

    for (const mdlItem of mdlItems) {
        let bestMatch: UserMedia | null = null;
        let bestScore = 0;

        // Extract season number from MDL title if present
        const mdlSeasonMatch = mdlItem.title.match(/season\s*(\d+)|part\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*season/i);
        const mdlSeasonNum = mdlSeasonMatch ? parseInt(mdlSeasonMatch[1] || mdlSeasonMatch[2] || mdlSeasonMatch[3]) : null;

        // Get base title without season info
        const mdlBaseTitle = mdlItem.title
            .replace(/:\s*season\s*\d+.*$/i, "")
            .replace(/\s*-?\s*season\s*\d+.*$/i, "")
            .replace(/\s*-?\s*part\s*\d+.*$/i, "")
            .replace(/\s*season\s*\d+.*$/i, "")
            .trim();

        for (const dbItem of dbItems) {
            // Skip if this database item was already matched
            if (usedDbItemIds.has(dbItem.id)) {
                continue;
            }

            // Calculate title similarity with both full title and base title
            const fullTitleScore = ratio(mdlItem.title.toLowerCase(), (dbItem.title || "").toLowerCase());

            const baseTitleScore = ratio(mdlBaseTitle.toLowerCase(), (dbItem.title || "").toLowerCase());

            // Use the better score
            const titleScore = Math.max(fullTitleScore, baseTitleScore);

            // Season matching bonus/penalty
            let seasonBonus = 0;
            if (mdlSeasonNum !== null && dbItem.season) {
                if (mdlSeasonNum === dbItem.season) {
                    // Exact season match - big bonus
                    seasonBonus = 30;
                } else {
                    // Season mismatch - penalty to prevent wrong matches
                    seasonBonus = -50;
                }
            } else if (mdlSeasonNum === null && dbItem.season === 1) {
                // MDL title has no season number, DB is season 1 - likely a match
                seasonBonus = 10;
            }

            // Year matching bonus
            let yearBonus = 0;
            if (mdlItem.year && dbItem.year) {
                const mdlYear = parseInt(mdlItem.year);
                const prismaYear = dbItem.year;
                if (mdlYear === prismaYear) {
                    yearBonus = 20;
                } else if (Math.abs(mdlYear - prismaYear) === 1) {
                    yearBonus = 10;
                }
            }

            // Country matching bonus (Asian content is likely from MDL)
            let countryBonus = 0;
            const asianCountries = ["KR", "JP", "CN", "TW", "TH"];
            if (dbItem.originCountry && asianCountries.includes(dbItem.originCountry)) {
                countryBonus = 5;
            }

            // Calculate total score
            const totalScore = titleScore + seasonBonus + yearBonus + countryBonus;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = dbItem;
            }
        }

        // Only include matches with confidence > 70%
        if (bestMatch && bestScore >= 70) {
            matches.push({
                mdlItem,
                dbItem: bestMatch,
                confidence: bestScore,
            });
            // Mark this database item as used so it can't be matched again
            usedDbItemIds.add(bestMatch.id);
        }
    }

    return matches;
}

/**
 * Main action to import MDL notes
 */
export async function importMDLNotes(userId: string, mdlUsername: string = "Popoooo_") {
    try {
        // Scrape MDL watchlist
        console.log(`Scraping MDL watchlist for ${mdlUsername}...`);
        const mdlItems = await scrapeMDLWatchlist(mdlUsername);

        if (mdlItems.length === 0) {
            return {
                success: false,
                message: "No items found in MDL watchlist",
            };
        }

        // Get user's current watchlist from database
        const dbItems = await prisma.userMedia.findMany({
            where: { userId },
        });

        // Match items
        const matches = matchItems(mdlItems, dbItems);

        // Update matched items with MDL ratings and notes
        let updatedCount = 0;
        for (const match of matches) {
            // Only update items with high confidence (80%+)
            if (match.confidence >= 80) {
                const updateData: { notes?: string; mdlRating?: number } = {};

                // Add notes if available
                if (match.mdlItem.notes) {
                    updateData.notes = match.mdlItem.notes;
                }

                // Add MDL community rating if available (and not 0.0)
                if (match.mdlItem.rating && parseFloat(match.mdlItem.rating) > 0) {
                    updateData.mdlRating = parseFloat(match.mdlItem.rating);
                }

                // Only update if we have something to update
                if (Object.keys(updateData).length > 0) {
                    await prisma.userMedia.update({
                        where: { id: match.dbItem.id },
                        data: updateData,
                    });
                    updatedCount++;
                }
            }
        }

        return {
            success: true,
            message: `Successfully matched ${matches.length} items and updated ${updatedCount} with notes`,
            stats: {
                scraped: mdlItems.length,
                matched: matches.length,
                updated: updatedCount,
            },
            matches: matches.map((m) => ({
                title: m.mdlItem.title,
                matchedTo: m.dbItem.title,
                confidence: m.confidence,
                hasNotes: !!m.mdlItem.notes,
            })),
        };
    } catch (error) {
        console.error("Error importing MDL notes:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error occurred",
        };
    }
}
