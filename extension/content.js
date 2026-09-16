"use strict";

/**
 * Stills for one chart, the moment the app's page asks. The page (the
 * admin's generate button) dispatches `trackr:chart` on window with the
 * chart's MDL slug — when a run lands, and on load for a chart with no
 * still yet. This script reads asianwiki through the service worker and
 * posts the cast rows to the page's own origin, so in production the row
 * gets its stills without a dev server or a click; then it tells the page
 * what happened with `trackr:stills`.
 *
 * Event details cross the page/extension boundary as JSON strings — a
 * plain object from the page is not always readable from here.
 */
(() => {
    if (typeof TrackrStills === "undefined") return;
    const appUrl = location.origin;
    const done = new Set();

    const fetchHtml = (url) =>
        new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: "fetch-html", url }, (res) => {
                if (chrome.runtime.lastError || !res) resolve({ ok: false, status: 0, url, text: "", error: chrome.runtime.lastError?.message ?? "no response" });
                else resolve(res);
            });
        });

    const tell = (detail) => window.dispatchEvent(new CustomEvent("trackr:stills", { detail: JSON.stringify(detail) }));

    async function handle(mdlSlug, force, page) {
        if (done.has(mdlSlug) && !force) return;
        done.add(mdlSlug);
        tell({ mdlSlug, status: "started" });
        try {
            const list = await fetch(`${appUrl}/api/ext/character-maps`, { credentials: "include" });
            if (!list.ok) return tell({ mdlSlug, status: "failed", error: `app ${list.status}` });
            const { charts } = await list.json();
            const chart = charts.find((c) => c.mdlSlug === mdlSlug);
            if (!chart) return tell({ mdlSlug, status: "skipped", reason: "not a Korean or Japanese chart" });
            if (chart.withStill > 0 && !force) return tell({ mdlSlug, status: "skipped", reason: "already has stills" });
            const out = await TrackrStills.stillsForChart(fetchHtml, appUrl, page ? { ...chart, asianwiki: page } : chart);
            if (out.error) tell({ mdlSlug, status: "failed", error: out.error, seen: out.seen });
            else tell({ mdlSlug, status: "done", page: out.page, matched: out.matched, people: out.people, unmatched: out.unmatched });
        } catch (e) {
            tell({ mdlSlug, status: "failed", error: e.message });
        }
    }

    window.addEventListener("trackr:chart", (e) => {
        let detail = {};
        try { detail = typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail ?? {}; } catch { return; }
        if (typeof detail.mdlSlug === "string") void handle(detail.mdlSlug, !!detail.force, typeof detail.page === "string" && detail.page.trim() ? detail.page.trim() : null);
    });

    // So the page knows a listener is there — a mark it can read at any time,
    // since this runs before or after the page's own scripts
    document.documentElement.dataset.trackrStills = "1";
})();
