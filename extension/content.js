"use strict";

/**
 * What the app's page can ask this extension for, on the chart pages:
 *
 * - stills for one chart: `trackr:chart` on window with the chart's MDL
 *   slug — when a run lands, and on load for a chart with no still yet.
 *   This script reads asianwiki through the service worker and posts the
 *   cast rows to the page's own origin, so in production the row gets its
 *   stills without a dev server or a click; then it tells the page what
 *   happened with `trackr:stills`.
 * - the episode recaps for one drama: `trackr:recaps-ask` with the slug,
 *   the source the page chose by country — dramabeans for a K-drama,
 *   cpophome for a C-drama — the title and what else finds the drama there
 *   (other titles, episode count, the offset of a split airing), and a hint
 *   given by hand when the title alone does not find it. The recaps are
 *   read through the worker, posted to the app, which keeps them for the
 *   chart's next run, and the page hears back with `trackr:recaps`.
 *
 * Event details cross the page/extension boundary as JSON strings — a
 * plain object from the page is not always readable from here.
 */
(() => {
    if (typeof TrackrStills === "undefined" || typeof TrackrRecaps === "undefined" || typeof TrackrCpophome === "undefined") return;
    const appUrl = location.origin;
    const done = new Set();

    const ask = (type, url) =>
        new Promise((resolve) => {
            chrome.runtime.sendMessage({ type, url }, (res) => {
                if (chrome.runtime.lastError || !res) resolve({ ok: false, status: 0, url, text: "", data: null, error: chrome.runtime.lastError?.message ?? "no response" });
                else resolve(res);
            });
        });
    const fetchHtml = (url) => ask("fetch-html", url);
    const fetchJson = (url) => ask("fetch-json", url);

    const tell = (event, detail) => window.dispatchEvent(new CustomEvent(event, { detail: JSON.stringify(detail) }));

    async function stills(mdlSlug, force, page) {
        if (done.has(mdlSlug) && !force) return;
        done.add(mdlSlug);
        tell("trackr:stills", { mdlSlug, status: "started" });
        try {
            const list = await fetch(`${appUrl}/api/ext/character-maps`, { credentials: "include" });
            if (!list.ok) return tell("trackr:stills", { mdlSlug, status: "failed", error: `app ${list.status}` });
            const { charts } = await list.json();
            const chart = charts.find((c) => c.mdlSlug === mdlSlug);
            if (!chart) return tell("trackr:stills", { mdlSlug, status: "skipped", reason: "not a Korean or Japanese chart" });
            if (chart.withStill > 0 && !force) return tell("trackr:stills", { mdlSlug, status: "skipped", reason: "already has stills" });
            const out = await TrackrStills.stillsForChart(fetchHtml, appUrl, page ? { ...chart, asianwiki: page } : chart);
            if (out.error) tell("trackr:stills", { mdlSlug, status: "failed", error: out.error, seen: out.seen });
            else tell("trackr:stills", { mdlSlug, status: "done", page: out.page, matched: out.matched, people: out.people, unmatched: out.unmatched });
        } catch (e) {
            tell("trackr:stills", { mdlSlug, status: "failed", error: e.message });
        }
    }

    async function recaps(drama) {
        const { mdlSlug, source } = drama;
        tell("trackr:recaps", { mdlSlug, status: "started" });
        try {
            const progress = (read, of) => tell("trackr:recaps", { mdlSlug, status: "started", read, of });
            const out = source === "cpophome" ? await TrackrCpophome.recapsFor(fetchHtml, drama, progress) : await TrackrRecaps.recapsFor(fetchJson, drama.title, drama.hint);
            if (out.error) return tell("trackr:recaps", { mdlSlug, status: "failed", error: out.error, seen: out.seen, needsTab: out.needsTab });
            if (out.recaps.length === 0) return tell("trackr:recaps", { mdlSlug, status: "failed", error: `no readable recap under "${out.tag}"` });
            const res = await fetch(`${appUrl}/api/ext/character-maps/recaps`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mdlSlug, source, recaps: out.recaps }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                return tell("trackr:recaps", { mdlSlug, status: "failed", error: body.error ?? `app ${res.status}`, seen: out.tag ? [out.tag] : undefined });
            }
            const { summary } = await res.json();
            tell("trackr:recaps", { mdlSlug, status: "done", tag: out.tag, listed: out.listed ?? undefined, skipped: out.skipped ?? undefined, ...summary });
        } catch (e) {
            tell("trackr:recaps", { mdlSlug, status: "failed", error: e.message });
        }
    }

    const detailOf = (e) => {
        try { return typeof e.detail === "string" ? JSON.parse(e.detail) : e.detail ?? {}; } catch { return null; }
    };
    const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

    window.addEventListener("trackr:chart", (e) => {
        const d = detailOf(e);
        if (d && str(d.mdlSlug)) void stills(d.mdlSlug, !!d.force, str(d.page));
    });
    window.addEventListener("trackr:recaps-ask", (e) => {
        const d = detailOf(e);
        if (!d || !str(d.mdlSlug) || !str(d.title)) return;
        void recaps({
            mdlSlug: d.mdlSlug,
            source: str(d.source) === "cpophome" ? "cpophome" : "dramabeans",
            title: d.title,
            hint: str(d.hint),
            akas: Array.isArray(d.akas) ? d.akas.filter((t) => typeof t === "string") : [],
            episodes: Number.isInteger(d.episodes) ? d.episodes : null,
            episodeOffset: Number.isInteger(d.episodeOffset) ? d.episodeOffset : 0,
        });
    });

    // So the page knows a listener is there. This runs before or after the
    // page's own scripts, so it both announces itself and answers a ping —
    // whichever of the two came second does not miss the other.
    const announce = () => window.dispatchEvent(new CustomEvent("trackr:extension", { detail: JSON.stringify({ stills: true, recaps: ["dramabeans", "cpophome"] }) }));
    window.addEventListener("trackr:ping", announce);
    announce();
})();
