"use server";

import puppeteer, { Browser, Page, HTTPRequest } from "puppeteer-core";
import chromium from "@sparticuz/chromium-min";
import { ratio } from "fuzzball";
import { prisma } from "@/lib/prisma";
import type { UserMedia } from "@prisma/client";

// --- Types ---
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

const MDL_STATUS_PAGES = [
    { suffix: "", status: "Watching" },
    { suffix: "/completed", status: "Completed" },
    { suffix: "/on_hold", status: "On Hold" },
    { suffix: "/dropped", status: "Dropped" },
    { suffix: "/plan_to_watch", status: "Plan to Watch" },
];

/**
 * Helper to launch the browser based on environment
 */
async function getBrowser(): Promise<Browser> {
    const isProd = process.env.NODE_ENV === "production";

    // Fix: Accessing chromium properties correctly for TS
    // @sparticuz/chromium-min might not export types perfectly,
    // so we use standard Puppeteer defaults if they are missing.
    return await puppeteer.launch({
        args: isProd ? [...chromium.args, "--hide-scrollbars", "--disable-web-security"] : ["--no-sandbox"],
        defaultViewport: { width: 1280, height: 720 },
        executablePath: isProd
            ? await chromium.executablePath(`https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar`)
            : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        headless: isProd ? true : true, // Explicitly set boolean
    });
}

/**
 * Optimized scraping for a single page
 */
async function scrapeMDLPage(browser: Browser, url: string, defaultStatus: string): Promise<MDLItem[]> {
    const page: Page = await browser.newPage();
    try {
        await page.setRequestInterception(true);

        // Fix: Explicitly type 'req' as HTTPRequest
        page.on("request", (req: HTTPRequest) => {
            if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 9000,
        });

        // Fix: Type the return of page.evaluate
        const items = await page.evaluate((status: string): MDLItem[] => {
            const results: MDLItem[] = [];
            const rows = document.querySelectorAll(".msv2-table tbody tr, table tbody tr");

            rows.forEach((row) => {
                const titleEl = row.querySelector(".msv2-i-title .title");
                const title = titleEl?.textContent?.trim() || "";
                if (!title) return;

                results.push({
                    title,
                    year: row.querySelector(".msv2-i-year")?.textContent?.trim() || null,
                    rating: row.querySelector(".msv2-i-mdlscore .score")?.textContent?.trim() || null,
                    status,
                    progress: row.querySelector(".episode-seen")?.textContent?.trim() || "0",
                    notes: null,
                });
            });
            return results;
        }, defaultStatus);

        return items;
    } catch (error) {
        console.error(`Error on ${url}:`, error);
        return [];
    } finally {
        await page.close();
    }
}

// ... (matchItems function remains the same as previous)
function matchItems(mdlItems: MDLItem[], dbItems: UserMedia[]): MatchResult[] {
    const matches: MatchResult[] = [];
    const usedDbItemIds = new Set<string>();

    for (const mdlItem of mdlItems) {
        let bestMatch: UserMedia | null = null;
        let bestScore = 0;

        const mdlSeasonMatch = mdlItem.title.match(/season\s*(\d+)|part\s*(\d+)|(\d+)(?:st|nd|rd|th)\s*season/i);
        const mdlSeasonNum = mdlSeasonMatch ? parseInt(mdlSeasonMatch[1] || mdlSeasonMatch[2] || mdlSeasonMatch[3]) : null;

        const mdlBaseTitle = mdlItem.title
            .replace(/:\s*season\s*\d+.*$/i, "")
            .replace(/\s*-?\s*season\s*\d+.*$/i, "")
            .replace(/\s*-?\s*part\s*\d+.*$/i, "")
            .replace(/\s*season\s*\d+.*$/i, "")
            .trim();

        for (const dbItem of dbItems) {
            if (usedDbItemIds.has(dbItem.id)) continue;

            const fullTitleScore = ratio(mdlItem.title.toLowerCase(), (dbItem.title || "").toLowerCase());
            const baseTitleScore = ratio(mdlBaseTitle.toLowerCase(), (dbItem.title || "").toLowerCase());
            const titleScore = Math.max(fullTitleScore, baseTitleScore);

            let seasonBonus = 0;
            if (mdlSeasonNum !== null && dbItem.season) {
                seasonBonus = mdlSeasonNum === dbItem.season ? 30 : -50;
            } else if (mdlSeasonNum === null && dbItem.season === 1) {
                seasonBonus = 10;
            }

            let yearBonus = 0;
            if (mdlItem.year && dbItem.year) {
                const mdlYear = parseInt(mdlItem.year);
                if (mdlYear === dbItem.year) yearBonus = 20;
                else if (Math.abs(mdlYear - dbItem.year) === 1) yearBonus = 10;
            }

            const totalScore = titleScore + seasonBonus + yearBonus;

            if (totalScore > bestScore) {
                bestScore = totalScore;
                bestMatch = dbItem;
            }
        }

        if (bestMatch && bestScore >= 70) {
            matches.push({ mdlItem, dbItem: bestMatch, confidence: bestScore });
            usedDbItemIds.add(bestMatch.id);
        }
    }
    return matches;
}

/**
 * MAIN ACTION
 */
export async function importMDLNotes(userId: string, mdlUsername: string = "Popoooo_") {
    const startTime = performance.now();
    let browser: Browser | null = null;

    try {
        browser = await getBrowser();

        const scrapePromises = MDL_STATUS_PAGES.map((config) => {
            const url = `https://mydramalist.com/dramalist/${mdlUsername}${config.suffix}`;
            // @ts-expect-error browser is checked in try/finally
            return scrapeMDLPage(browser, url, config.status);
        });

        const results = await Promise.all(scrapePromises);
        const allScrapedItems = results.flat();

        const uniqueMdlItems = Array.from(new Map(allScrapedItems.map((item) => [`${item.title}-${item.year}`, item])).values());

        if (uniqueMdlItems.length === 0) {
            return { success: false, message: "No items found. MDL might be blocking the request." };
        }

        const dbItems = await prisma.userMedia.findMany({ where: { userId } });
        const matches = matchItems(uniqueMdlItems, dbItems);

        let updatedCount = 0;
        for (const match of matches) {
            if (match.confidence >= 80) {
                const rating = match.mdlItem.rating ? parseFloat(match.mdlItem.rating) : 0;
                if (rating > 0) {
                    await prisma.userMedia.update({
                        where: { id: match.dbItem.id },
                        data: { mdlRating: rating },
                    });
                    updatedCount++;
                }
            }
        }

        const endTime = performance.now();
        const totalTime = ((endTime - startTime) / 1000).toFixed(2);

        return {
            success: true,
            message: `Successfully updated ${updatedCount} items!`,
            stats: { scraped: uniqueMdlItems.length, matched: matches.length, updated: updatedCount },
            duration: totalTime,
        };
    } catch (error: unknown) {
        console.error("Import Error:", error);
        return {
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
        };
    } finally {
        if (browser) await browser.close();
    }
}
