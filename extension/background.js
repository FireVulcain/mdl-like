"use strict";

/**
 * The one thing the service worker does: fetch a page for the content
 * script. A content script's fetch is held to the page's CORS, and none of
 * asianwiki, dramabeans or cpophome allows any; the worker's is not. Only
 * those three are served — this is not a general proxy for pages to use.
 * asianwiki and cpophome come back as HTML, dramabeans' WordPress API as
 * JSON.
 *
 * cpophome is not fetched from here. Its Cloudflare sets a managed
 * challenge that a human passes once, in a tab, and then turns the worker's
 * fetch away all the same, clearance cookie or not — it tells a worker's
 * request from a page's. So a cpophome page is fetched by that tab: the
 * content script there (cpophome-tab.js) makes the same-origin fetch the
 * site's own pages make, and hands the response back. No tab, or a tab
 * still on the challenge, and the reader is told to open one.
 */
const ALLOWED = /^https:\/\/(asianwiki\.com|(www\.)?dramabeans\.com)\//;
const VIA_TAB = /^https:\/\/(www\.)?cpophome\.com\//;
const CPOPHOME_TABS = ["https://www.cpophome.com/*", "https://cpophome.com/*"];

// A cpophome page, fetched by whichever cpophome tab answers. A tab opened
// before the extension was (re)loaded has no script in it and does not.
async function viaTab(url) {
    const tabs = await chrome.tabs.query({ url: CPOPHOME_TABS });
    for (const tab of tabs) {
        try {
            const res = await chrome.tabs.sendMessage(tab.id, { type: "cpophome-fetch", url });
            if (res) return res;
        } catch {
            // no script in that tab; the next may have one
        }
    }
    return { ok: false, status: 0, url, text: "", error: "no cpophome tab", noTab: true };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["fetch-html", "fetch-json"].includes(message?.type)) return false;
    if (message.type === "fetch-html" && VIA_TAB.test(message.url)) {
        viaTab(message.url).then(sendResponse, (e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", error: e.message }));
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
