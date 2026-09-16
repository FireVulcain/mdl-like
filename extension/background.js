"use strict";

/**
 * The one thing the service worker does: fetch an asianwiki page for the
 * content script. A content script's fetch is held to the page's CORS, and
 * asianwiki allows none; the worker's is not. Only asianwiki is served —
 * this is not a general proxy for pages to use.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "fetch-html" || !/^https:\/\/asianwiki\.com\//.test(message.url)) return false;
    fetch(message.url, { credentials: "omit" })
        .then(async (res) => sendResponse({ ok: res.ok, status: res.status, url: res.url, text: res.ok ? await res.text() : "" }))
        .catch((e) => sendResponse({ ok: false, status: 0, url: message.url, text: "", error: e.message }));
    return true; // the response comes later
});
