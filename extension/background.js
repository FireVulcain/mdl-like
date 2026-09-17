"use strict";

/**
 * The one thing the service worker does: fetch a page for the content
 * script. A content script's fetch is held to the page's CORS, and neither
 * asianwiki nor dramabeans allows any; the worker's is not. Only those two
 * are served — this is not a general proxy for pages to use. asianwiki
 * comes back as HTML, dramabeans' WordPress API as JSON.
 */
const ALLOWED = /^https:\/\/(asianwiki\.com|(www\.)?dramabeans\.com)\//;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["fetch-html", "fetch-json"].includes(message?.type) || !ALLOWED.test(message.url)) return false;
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
