"use strict";

/**
 * The one thing the service worker does: fetch a page for the content
 * script. A content script's fetch is held to the page's CORS, and none of
 * asianwiki, dramabeans, thereviewgeek or cpophome allows any; the
 * worker's is not. Only those four are served — this is not a general
 * proxy for pages to use. asianwiki, thereviewgeek and cpophome come back
 * as HTML, dramabeans' WordPress API as JSON.
 *
 * cpophome is not fetched from here. Its Cloudflare sets a managed
 * challenge that a human passes once, in a tab, and then turns the worker's
 * fetch away all the same, clearance cookie or not — it tells a worker's
 * request from a page's. So a cpophome page is fetched by that tab: the
 * content script there (tab-fetch.js) makes the same-origin fetch the
 * site's own pages make, and hands the response back. No tab, or a tab
 * still on the challenge, and the reader is told to open one.
 *
 * thereviewgeek is fetched from here first, and through one of its tabs
 * only when the worker's fetch comes back as the challenge — so a reader
 * whom Cloudflare lets through never has to open the site.
 */
const ALLOWED = /^https:\/\/(asianwiki\.com|(www\.)?dramabeans\.com|(www\.)?thereviewgeek\.com)\//;
const VIA_TAB = /^https:\/\/(www\.)?cpophome\.com\//;
const TRY_TAB = /^https:\/\/(www\.)?thereviewgeek\.com\//;
const TABS = {
    cpophome: ["https://www.cpophome.com/*", "https://cpophome.com/*"],
    thereviewgeek: ["https://www.thereviewgeek.com/*", "https://thereviewgeek.com/*"],
};

// A page, fetched by whichever of the site's tabs answers. A tab opened
// before the extension was (re)loaded has no script in it and does not.
async function viaTab(url) {
    const site = VIA_TAB.test(url) ? "cpophome" : "thereviewgeek";
    const tabs = await chrome.tabs.query({ url: TABS[site] });
    for (const tab of tabs) {
        try {
            const res = await chrome.tabs.sendMessage(tab.id, { type: "tab-fetch", url });
            if (res) return res;
        } catch {
            // no script in that tab; the next may have one
        }
    }
    return { ok: false, status: 0, url, text: "", error: `no ${site} tab`, noTab: true };
}

// Cloudflare's challenge, however it came: a 403/503, or a 200 that is the interstitial
const challenged = (res) => res.status === 403 || res.status === 503 || /<title>\s*Just a moment/i.test(res.text || "");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["fetch-html", "fetch-json"].includes(message?.type)) return false;
    if (message.type === "fetch-html" && VIA_TAB.test(message.url)) {
        viaTab(message.url).then(sendResponse, (e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", error: e.message }));
        return true;
    }
    if (message.type === "fetch-html" && TRY_TAB.test(message.url)) {
        fetch(message.url, { credentials: "omit" })
            .then(async (res) => ({ ok: res.ok, status: res.status, url: res.url, text: await res.text().catch(() => "") }))
            .then((res) => (challenged(res) ? viaTab(message.url) : res))
            .then(sendResponse, (e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", error: e.message }));
        return true;
    }
    if (!ALLOWED.test(message.url)) return false;
    fetch(message.url, { credentials: "omit" })
        .then(async (res) => {
            if (message.type === "fetch-json") {
                let data = null;
                try { data = res.ok ? await res.json() : null; } catch { /* not JSON: data stays null */ }
                sendResponse({ ok: res.ok && data !== null, status: res.status, url: res.url, data });
            } else {
                sendResponse({ ok: res.ok, status: res.status, url: res.url, text: res.ok ? await res.text() : "" });
            }
        })
        .catch((e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", data: null, error: e.message }));
    return true; // the response comes later
});
