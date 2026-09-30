import { prisma } from "@/lib/prisma";

/**
 * What /admin/scraper shows, computed from ScraperCall and ScraperCacheHit.
 *
 * A month is ~30,000 call rows at today's pace; they are read once per page
 * load and folded here, so the browser only receives buckets and totals. The
 * console reads its own slice through listScraperCalls.
 */

export const SCRAPER_PERIODS = { "24h": 24 * 3600e3, "7d": 7 * 24 * 3600e3, "30d": 30 * 24 * 3600e3 } as const;
export type ScraperPeriod = keyof typeof SCRAPER_PERIODS;
const BUCKET_MS: Record<ScraperPeriod, number> = { "24h": 15 * 60e3, "7d": 3600e3, "30d": 6 * 3600e3 };

export const SCRAPER_TRIGGERS = ["render", "prefetch", "action", "background", "cron", "api", "script"] as const;

export type ScraperOverview = {
    period: ScraperPeriod;
    since: string;
    until: string;
    bucketMs: number;
    totals: {
        calls: number;
        ok: number;
        failed: number;
        failedByStatus: Record<string, number>;
        hits: number;
        openings: number;
        callsInOpenings: number;
        previousCalls: number;
        p50: number;
        p95: number;
        worstBurst: { count: number; at: string | null; page: string | null };
    };
    /** Per bucket, calls per trigger and per page key (top pages + "other"). */
    timeline: { t: string; byTrigger: Record<string, number>; byPage: Record<string, number> }[];
    topPages: string[];
    pages: { page: string; calls: number; openings: number; hits: number; worstBurst: number; p50: number }[];
    triggers: { trigger: string; calls: number; hits: number; last: string | null }[];
    failures: ScraperCallRow[];
};

export type ScraperCallRow = {
    id: string;
    at: string;
    route: string;
    target: string | null;
    /** The title or name to show; filled in by fillLabels when the row has none. */
    label: string | null;
    status: number;
    durationMs: number;
    trigger: string;
    page: string | null;
    pagePath: string | null;
    userId: string | null;
};

function worstWindow(times: number[], windowMs = 10e3): { count: number; at: number | null } {
    let best = 0, at: number | null = null, j = 0;
    for (let i = 0; i < times.length; i++) {
        while (times[i] - times[j] >= windowMs) j++;
        if (i - j + 1 > best) { best = i - j + 1; at = times[j]; }
    }
    return { count: best, at };
}

function quantile(values: number[], q: number): number {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

const pageKey = (page: string | null) => page ?? "—";

export async function getScraperOverview(period: ScraperPeriod): Promise<ScraperOverview> {
    const now = Date.now();
    const span = SCRAPER_PERIODS[period];
    const since = new Date(now - span);
    const bucketMs = BUCKET_MS[period];
    const start = Math.floor(since.getTime() / bucketMs) * bucketMs;

    const [rows, hitRows, previousCalls, failures] = await Promise.all([
        prisma.scraperCall.findMany({
            where: { at: { gte: since } },
            select: { at: true, trigger: true, page: true, status: true, viewId: true, durationMs: true },
            orderBy: { at: "asc" },
        }),
        prisma.scraperCacheHit.findMany({ where: { hour: { gte: new Date(Math.floor(since.getTime() / 3600e3) * 3600e3) } } }),
        prisma.scraperCall.count({ where: { at: { gte: new Date(now - 2 * span), lt: since } } }),
        prisma.scraperCall.findMany({
            where: { at: { gte: since }, OR: [{ status: { gte: 400 } }, { status: 0 }] },
            orderBy: { at: "desc" },
            take: 20,
        }),
    ]);

    const times = rows.map((r) => r.at.getTime());
    const failed = rows.filter((r) => r.status >= 400 || r.status === 0);
    const failedByStatus: Record<string, number> = {};
    for (const f of failed) failedByStatus[String(f.status)] = (failedByStatus[String(f.status)] ?? 0) + 1;

    const burst = worstWindow(times);
    const burstPage = burst.at != null ? rows.find((r) => r.at.getTime() >= burst.at!)?.page ?? null : null;

    const openingRows = rows.filter((r) => r.viewId && (r.trigger === "render" || r.trigger === "prefetch"));
    const openings = new Set(openingRows.map((r) => r.viewId)).size;

    // Pages, ranked by calls; the timeline splits the top four out.
    const byPage = new Map<string, typeof rows>();
    for (const r of rows) {
        const k = pageKey(r.page);
        if (!byPage.has(k)) byPage.set(k, []);
        byPage.get(k)!.push(r);
    }
    const hitsByPage = new Map<string, number>();
    const hitsByTrigger = new Map<string, number>();
    for (const h of hitRows) {
        hitsByPage.set(h.page, (hitsByPage.get(h.page) ?? 0) + h.count);
        hitsByTrigger.set(h.trigger, (hitsByTrigger.get(h.trigger) ?? 0) + h.count);
    }
    const pages = [...new Set([...byPage.keys(), ...hitsByPage.keys()])]
        .map((page) => {
            const list = byPage.get(page) ?? [];
            return {
                page,
                calls: list.length,
                openings: new Set(list.filter((r) => r.viewId && (r.trigger === "render" || r.trigger === "prefetch")).map((r) => r.viewId)).size,
                hits: hitsByPage.get(page) ?? 0,
                worstBurst: worstWindow(list.map((r) => r.at.getTime())).count,
                p50: quantile(list.map((r) => r.durationMs), 0.5),
            };
        })
        .sort((a, b) => b.calls - a.calls || b.hits - a.hits);
    const topPages = pages.filter((p) => p.calls > 0).slice(0, 4).map((p) => p.page);

    const n = Math.ceil((now - start) / bucketMs);
    const timeline = Array.from({ length: n }, (_, i) => ({ t: new Date(start + i * bucketMs).toISOString(), byTrigger: {} as Record<string, number>, byPage: {} as Record<string, number> }));
    for (const r of rows) {
        const b = timeline[Math.floor((r.at.getTime() - start) / bucketMs)];
        if (!b) continue;
        b.byTrigger[r.trigger] = (b.byTrigger[r.trigger] ?? 0) + 1;
        const pk = topPages.includes(pageKey(r.page)) ? pageKey(r.page) : "other";
        b.byPage[pk] = (b.byPage[pk] ?? 0) + 1;
    }

    const triggers = [...new Set([...rows.map((r) => r.trigger), ...hitsByTrigger.keys()])]
        .map((trigger) => {
            const list = rows.filter((r) => r.trigger === trigger);
            return { trigger, calls: list.length, hits: hitsByTrigger.get(trigger) ?? 0, last: list.length ? list[list.length - 1].at.toISOString() : null };
        })
        .sort((a, b) => b.calls - a.calls);

    const durations = rows.map((r) => r.durationMs);
    return {
        period,
        since: since.toISOString(),
        until: new Date(now).toISOString(),
        bucketMs,
        totals: {
            calls: rows.length,
            ok: rows.length - failed.length,
            failed: failed.length,
            failedByStatus,
            hits: hitRows.reduce((a, h) => a + h.count, 0),
            openings,
            callsInOpenings: openingRows.length,
            previousCalls,
            p50: quantile(durations, 0.5),
            p95: quantile(durations, 0.95),
            worstBurst: { count: burst.count, at: burst.at != null ? new Date(burst.at).toISOString() : null, page: burstPage },
        },
        timeline,
        topPages,
        pages,
        triggers,
        failures: await (async () => { const f = failures.map(toRow); await fillLabels(f); return f; })(),
    };
}

function toRow(r: { id: bigint; at: Date; route: string; target: string | null; label: string | null; status: number; durationMs: number; trigger: string; page: string | null; pagePath: string | null; userId: string | null }): ScraperCallRow {
    return { id: r.id.toString(), at: r.at.toISOString(), route: r.route, target: r.target, label: r.label, status: r.status, durationMs: r.durationMs, trigger: r.trigger, page: r.page, pagePath: r.pagePath, userId: r.userId };
}

/**
 * A title for rows that came back without one: failed calls, comments (which
 * name a title by its bare MDL number, "735043"), and anything logged before
 * labels were. Looked up, in order, in other calls about the same title, the
 * poster cache, the linked watchlist entry and the person cache — never MDL.
 */
async function fillLabels(rows: ScraperCallRow[]): Promise<void> {
    const missing = rows.filter((r) => !r.label && r.target);
    if (!missing.length) return;
    const isPerson = (r: ScraperCallRow) => r.route === "person" || r.route === "person-extra";
    const numeric = [...new Set(missing.filter((r) => !isPerson(r) && /^\d+$/.test(r.target!)).map((r) => r.target!))].slice(0, 100);
    const slugs = [...new Set(missing.filter((r) => !/^\d+$/.test(r.target!)).map((r) => r.target!))].slice(0, 300);

    const known = new Map<string, string>();
    const byId = (slug: string) => slug.split("-")[0];
    const [logged, posters, links, people] = await Promise.all([
        prisma.scraperCall.findMany({
            where: { label: { not: null }, OR: [{ target: { in: slugs } }, ...numeric.map((id) => ({ target: { startsWith: `${id}-` } }))] },
            select: { target: true, label: true },
            distinct: ["target"],
            take: 500,
        }),
        prisma.cachedMdlPoster.findMany({
            where: { OR: [{ slug: { in: slugs } }, ...numeric.map((id) => ({ slug: { startsWith: `${id}-` } }))] },
            select: { slug: true, title: true },
        }),
        prisma.cachedMdlData.findMany({
            where: { OR: [{ mdlSlug: { in: slugs } }, ...numeric.map((id) => ({ mdlSlug: { startsWith: `${id}-` } }))] },
            select: { mdlSlug: true, tmdbExternalId: true },
        }),
        prisma.cachedKuryanaPerson.findMany({ where: { slug: { in: slugs } }, select: { slug: true, dataJson: true } }),
    ]);
    const titles = links.length
        ? await prisma.userMedia.findMany({ where: { externalId: { in: links.map((l) => l.tmdbExternalId) }, title: { not: null } }, select: { externalId: true, title: true } })
        : [];
    const titleByTmdb = new Map(titles.map((t) => [t.externalId, t.title!]));

    const put = (slug: string | null, label: string | null | undefined) => {
        if (!slug || !label) return;
        if (!known.has(slug)) known.set(slug, label);
        if (!known.has(byId(slug))) known.set(byId(slug), label);
    };
    logged.forEach((l) => put(l.target, l.label));
    posters.forEach((p) => put(p.slug, p.title));
    links.forEach((l) => put(l.mdlSlug, titleByTmdb.get(l.tmdbExternalId)));
    people.forEach((p) => put(p.slug, (p.dataJson as { name?: string } | null)?.name));

    for (const r of missing) r.label = known.get(r.target!) ?? null;
}

export type ScraperConsoleFilters = {
    period: ScraperPeriod;
    trigger?: string;
    page?: string;
    failedOnly?: boolean;
    q?: string;
    grouped?: boolean;
    offset?: number;
};

export type ScraperCallGroup = {
    key: string;
    /** A page opening (one server request) or a run of the same cron. */
    kind: "opening" | "run" | "single";
    page: string | null;
    pagePath: string | null;
    trigger: string;
    userId: string | null;
    first: string;
    last: string;
    calls: ScraperCallRow[];
    failed: number;
};

const GROUP_LIMIT = 15;
const ROW_SCAN = 3000;

/**
 * The console's page of results. Groups are built from the newest 3,000
 * matching calls: an opening by its request id, a cron or background run by
 * its page and trigger while the calls keep coming less than a minute apart.
 */
export async function listScraperCalls(f: ScraperConsoleFilters): Promise<{ groups: ScraperCallGroup[]; total: number; hasMore: boolean }> {
    const since = new Date(Date.now() - SCRAPER_PERIODS[f.period]);
    const where = {
        at: { gte: since },
        ...(f.trigger ? { trigger: f.trigger } : {}),
        ...(f.page ? { page: f.page === "—" ? null : f.page } : {}),
        AND: [
            ...(f.failedOnly ? [{ OR: [{ status: { gte: 400 } }, { status: 0 }] }] : []),
            ...(f.q ? [{ OR: [{ target: { contains: f.q, mode: "insensitive" as const } }, { label: { contains: f.q, mode: "insensitive" as const } }] }] : []),
        ],
    };
    const [rows, total] = await Promise.all([
        prisma.scraperCall.findMany({ where, orderBy: { at: "desc" }, take: ROW_SCAN }),
        prisma.scraperCall.count({ where }),
    ]);
    const list = rows.map(toRow);
    const groups: ScraperCallGroup[] = [];

    if (f.grouped === false) {
        for (const r of list) groups.push({ key: `c${r.id}`, kind: "single", page: r.page, pagePath: r.pagePath, trigger: r.trigger, userId: r.userId, first: r.at, last: r.at, calls: [r], failed: r.status >= 400 || r.status === 0 ? 1 : 0 });
    } else {
        const byView = new Map<string, ScraperCallGroup>();
        const openRun = new Map<string, ScraperCallGroup>();
        for (let i = 0; i < list.length; i++) {
            const r = list[i], raw = rows[i];
            let g: ScraperCallGroup | undefined;
            if (raw.viewId) {
                g = byView.get(raw.viewId);
                if (!g) {
                    g = { key: `v${raw.viewId}`, kind: "opening", page: r.page, pagePath: r.pagePath, trigger: r.trigger, userId: r.userId, first: r.at, last: r.at, calls: [], failed: 0 };
                    byView.set(raw.viewId, g);
                    groups.push(g);
                }
            } else {
                const k = `${r.page}|${r.trigger}`;
                g = openRun.get(k);
                // Rows arrive newest first: a gap over a minute starts an older run
                if (!g || Date.parse(g.first) - Date.parse(r.at) > 60e3) {
                    g = { key: `r${r.id}`, kind: "run", page: r.page, pagePath: r.pagePath, trigger: r.trigger, userId: r.userId, first: r.at, last: r.at, calls: [], failed: 0 };
                    openRun.set(k, g);
                    groups.push(g);
                }
            }
            g.calls.push(r);
            g.first = r.at;
            if (r.status >= 400 || r.status === 0) g.failed++;
            if (!g.userId && r.userId) g.userId = r.userId;
        }
    }
    const offset = f.offset ?? 0;
    const page = groups.slice(offset, offset + GROUP_LIMIT);
    await fillLabels(page.flatMap((g) => g.calls));
    return { groups: page, total, hasMore: groups.length > offset + GROUP_LIMIT };
}
