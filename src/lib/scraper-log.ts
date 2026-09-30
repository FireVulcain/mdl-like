import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { cache } from "react";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { actionAsyncStorage } from "next/dist/server/app-render/action-async-storage.external";
import { afterTaskAsyncStorage } from "next/dist/server/app-render/after-task-async-storage.external";
import { prisma } from "@/lib/prisma";

/**
 * Who asked the scraper for what — the data behind /admin/scraper.
 *
 * Every call that reaches MDL is written to ScraperCall; every read the cache
 * answered is counted in ScraperCacheHit. Nothing here may ever break or slow a
 * read: context is gathered from Next's own request stores (read, never
 * written, so no page becomes dynamic because of it), writes are buffered and
 * flushed in the background, and every step swallows its own errors.
 *
 * The stores are Next internals. If an upgrade renames them, the imports fail
 * at build time — not silently at runtime — and the fix is here alone.
 */

export type ScraperTrigger = "render" | "prefetch" | "action" | "background" | "cron" | "api" | "script";

export type ScraperContext = {
    trigger: ScraperTrigger;
    page: string | null;
    pagePath: string | null;
    viewId: string | null;
    userId: string | null;
};

/** Carries the context captured outside the cache into the miss that runs inside it. */
export const scraperContextStorage = new AsyncLocalStorage<ScraperContext>();

/** One id per server request: the calls of one page opening share it. */
const requestViewId = cache(() => randomUUID());

export async function captureScraperContext(): Promise<ScraperContext> {
    const ctx: ScraperContext = { trigger: "script", page: null, pagePath: null, viewId: null, userId: null };
    try {
        const work = workAsyncStorage.getStore();
        const unit = workUnitAsyncStorage.getStore();
        const inAfter = !!afterTaskAsyncStorage.getStore();
        const isAction = !!actionAsyncStorage.getStore()?.isAction;
        ctx.page = work?.route ?? null;

        if (unit?.type === "request") {
            ctx.pagePath = unit.url.pathname;
            if (!inAfter) ctx.viewId = requestViewId();
        }

        if (inAfter) ctx.trigger = "background";
        else if (ctx.page?.startsWith("/api/cron")) ctx.trigger = "cron";
        else if (ctx.page?.startsWith("/api")) ctx.trigger = "api";
        else if (unit?.type === "request" && unit.headers.get("next-router-prefetch") === "1") ctx.trigger = "prefetch";
        else if (isAction) ctx.trigger = "action";
        else if (unit?.type === "request") ctx.trigger = "render";
        else if (work) ctx.trigger = "render"; // prerender, unstable_cache and the like

        if (unit?.type === "request" && !inAfter && ctx.trigger !== "cron") {
            // Loaded only here, inside a real request, so scripts that read
            // the scraper never pull in the auth stack.
            const { getCurrentUserId } = await import("@/lib/session");
            ctx.userId = await getCurrentUserId().catch(() => null);
        }
    } catch {
        // Whatever could be read is kept; the rest stays null
    }
    return ctx;
}

/** The route family and the thing it was about, from a scraper path. */
export function scraperRouteOf(path: string): { route: string; target: string | null } {
    const bare = path.split("?")[0].replace(/\/+$/, "");
    const rules: [RegExp, string][] = [
        [/^\/id\/([^/]+)\/cast$/, "cast"],
        [/^\/id\/([^/]+)\/ratings$/, "ratings"],
        [/^\/id\/([^/]+)\/episodes$/, "episodes"],
        [/^\/id\/([^/]+)\/episode\/\d+$/, "episode"],
        [/^\/id\/([^/]+)\/reviews$/, "reviews"],
        [/^\/id\/([^/]+)\/threads$/, "threads"],
        [/^\/id\/([^/]+)\/photos$/, "photos"],
        [/^\/id\/([^/]+)\/recs$/, "recs"],
        [/^\/id\/([^/]+)$/, "details"],
        [/^\/people\/([^/]+)\/(?:photos|threads)$/, "person-extra"],
        [/^\/people\/([^/]+)$/, "person"],
        [/^\/top(?:\/([^/]+))?$/, "top"],
        [/^\/search\/q\/(.+)$/, "search"],
        [/^\/tags\/search$/, "tags"],
        [/^\/dramalist\/([^/]+)$/, "dramalist"],
    ];
    for (const [re, route] of rules) {
        const m = re.exec(bare);
        if (m) return { route, target: m[1] ? decodeURIComponent(m[1]) : route === "top" ? "all" : null };
    }
    return { route: "other", target: null };
}

/* ---------- buffered writes ---------- */

type CallRow = { at: Date; route: string; path: string; target: string | null; status: number; durationMs: number } & Omit<ScraperContext, never>;
const calls: CallRow[] = [];
const hits = new Map<string, { hour: Date; page: string; trigger: string; route: string; count: number }>();
let timer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 3000;

function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
        timer = null;
        void flush();
    }, FLUSH_MS);
    // Never keep a script alive just to write its log
    timer.unref?.();
}

async function flush() {
    if (calls.length) {
        const batch = calls.splice(0, calls.length);
        try {
            await prisma.scraperCall.createMany({ data: batch });
        } catch (e) {
            console.error("[scraper-log] could not write calls:", (e as Error).message);
        }
    }
    if (hits.size) {
        const batch = [...hits.values()];
        hits.clear();
        for (const h of batch) {
            try {
                await prisma.scraperCacheHit.upsert({
                    where: { hour_page_trigger_route: { hour: h.hour, page: h.page, trigger: h.trigger, route: h.route } },
                    create: h,
                    update: { count: { increment: h.count } },
                });
            } catch {
                // A lost counter is not worth a log line per request
            }
        }
    }
}

export function recordScraperCall(path: string, status: number, durationMs: number): void {
    if (process.env.SCRAPER_LOG === "off") return;
    try {
        const ctx = scraperContextStorage.getStore() ?? { trigger: "script" as const, page: null, pagePath: null, viewId: null, userId: null };
        const { route, target } = scraperRouteOf(path);
        calls.push({ at: new Date(), route, path: path.slice(0, 500), target: target?.slice(0, 200) ?? null, status, durationMs, ...ctx });
        schedule();
    } catch {
        // Logging never gets in the way of a read
    }
}

export function recordScraperCacheHit(path: string, ctx: ScraperContext): void {
    if (process.env.SCRAPER_LOG === "off") return;
    try {
        const hour = new Date();
        hour.setUTCMinutes(0, 0, 0);
        const { route } = scraperRouteOf(path);
        const page = ctx.page ?? "—";
        const key = `${hour.getTime()}|${page}|${ctx.trigger}|${route}`;
        const h = hits.get(key);
        if (h) h.count++;
        else hits.set(key, { hour, page, trigger: ctx.trigger, route, count: 1 });
        schedule();
    } catch {
        // Same
    }
}

/** The 90-day purge, run by the daily sync. */
export async function purgeScraperLog(days = 90): Promise<{ calls: number; hits: number }> {
    const before = new Date(Date.now() - days * 86_400_000);
    const [c, h] = await Promise.all([
        prisma.scraperCall.deleteMany({ where: { at: { lt: before } } }),
        prisma.scraperCacheHit.deleteMany({ where: { hour: { lt: before } } }),
    ]);
    return { calls: c.count, hits: h.count };
}
