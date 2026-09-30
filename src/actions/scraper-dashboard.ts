"use server";

import { isAdminUser } from "@/lib/admin";
import { listScraperCalls, SCRAPER_PERIODS, type ScraperConsoleFilters } from "@/lib/scraper-stats";

/** The console's reads. Admin only — the page's guard is not the only way in. */
export async function fetchScraperCalls(filters: ScraperConsoleFilters) {
    if (!(await isAdminUser())) throw new Error("Not allowed");
    const period = filters.period in SCRAPER_PERIODS ? filters.period : "24h";
    return listScraperCalls({ ...filters, period, q: filters.q?.slice(0, 100) });
}
