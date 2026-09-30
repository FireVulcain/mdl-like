import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isAdminUser } from "@/lib/admin";
import { getScraperOverview, SCRAPER_PERIODS, type ScraperPeriod } from "@/lib/scraper-stats";
import { ScraperDashboard } from "@/components/admin/scraper-dashboard";

export const metadata: Metadata = { title: "Scraper traffic" };
export const dynamic = "force-dynamic";

export default async function ScraperAdminPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
    if (!(await isAdminUser())) notFound();
    const { period: raw } = await searchParams;
    const period: ScraperPeriod = raw && raw in SCRAPER_PERIODS ? (raw as ScraperPeriod) : "24h";
    const overview = await getScraperOverview(period);

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            <ScraperDashboard overview={overview} />
        </div>
    );
}
