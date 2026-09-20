"use strict";

/**
 * Runs on cpophome.com, in the tab the reader opened to pass the site's
 * Cloudflare check. The service worker's own fetch is turned away there
 * even with the clearance cookie — Cloudflare tells a worker's request
 * from a page's — so the worker asks this tab to fetch instead (see
 * background.js): a same-origin fetch from a page that passed the check is
 * what the site itself does. Nothing else runs here: one message type, one
 * host, the response handed back as it came.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "cpophome-fetch" || typeof message.url !== "string" || !/^https:\/\/(www\.)?cpophome\.com\//.test(message.url)) return false;
    fetch(message.url, { credentials: "include" })
        .then(async (res) => sendResponse({ ok: res.ok, status: res.status, url: res.url, text: await res.text().catch(() => "") }))
        .catch((e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", error: e.message }));
    return true; // the response comes later
});
