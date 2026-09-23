"use strict";

/**
 * Episode recaps from CPOPHome, for Chinese dramas, read from the reader's
 * own browser. Its Cloudflare is stricter than Dramabeans': a managed
 * challenge that only a human passes, in a tab, and that turns the service
 * worker's own fetch away even afterwards. So the pages are fetched by
 * that tab (see background.js and tab-fetch.js): the reader opens
 * cpophome.com, ticks the box, keeps the tab open, and every fetch here
 * goes through it. No tab, or a tab still on the challenge, and the caller
 * is told which page to open. The site also rate-limits a browser that
 * reads forty pages in a row (Cloudflare's error 1015), so the recaps are
 * read a second and a half apart, and a limit that is hit anyway is waited
 * out twice before the read is given up.
 *
 * One drama is one page there, /<slug>/, and its recaps are
 * /<slug>/recap/<n>/, one per episode, every one listed in the
 * ul.recap_selector on the drama's page. The slug is not the title's: it
 * is the title as it was when the page was made plus the leads' names —
 * "the-perfect-match-ren-jialun-wang-herun" for what MDL now calls Fate
 * Chooses You — so the drama is found by the site's own search (/?s=), by
 * exact title: MDL's, or one of its "also known as". The recap's text is
 * the paragraphs of div.entry-content; the episode picker, the ads and the
 * previous/next links there are not paragraphs.
 *
 * MDL splits a long airing into "Part 1" and "Part 2"; the site has the one
 * drama. `offset` says how many recaps the part before this entry took
 * (27 for Love Like the Galaxy: Part 2), and `episodes` how many this part
 * has, so recaps 28-56 are read as episodes 1-29.
 *
 * `fetchHtml(url)` is the service worker's fetch (see content.js); it
 * resolves to { ok, status, url, text }. `onProgress(read, of)` hears each
 * recap land, for the line under the checkbox.
 */
const TrackrCpophome = (() => {
    const CP = "https://www.cpophome.com";
    const PAUSE_MS = 1500;
    // How long a rate limit is waited out, each time it is hit in one read
    const RETRY_MS = [20_000, 45_000];
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
    const parse = (html) => new DOMParser().parseFromString(html, "text/html");
    const pause = (ms = PAUSE_MS) => new Promise((r) => setTimeout(r, ms));

    // Cloudflare's rate limit: a 429, or its error 1015 page
    const limited = (res) => res.status === 429 || /Error 1015|being rate limited/i.test(res.text || "");
    const LIMITED = { error: "cpophome is rate-limiting this browser (error 1015) — wait a minute, then Read again" };

    // A page, with the rate limit waited out when it is hit
    async function get(fetchHtml, url) {
        for (let attempt = 0; ; attempt++) {
            const res = await fetchHtml(url);
            if (!limited(res) || attempt >= RETRY_MS.length) return res;
            await pause(RETRY_MS[attempt]);
        }
    }

    // No tab to fetch from, or the challenge page, however it came: a 403,
    // or a 200 that is the interstitial. Only its title says so — a real
    // page also loads Cloudflare's scripts (the comment form's Turnstile).
    const challenged = (res) => !!res.noTab || res.status === 403 || res.status === 503 || /<title>\s*Just a moment/i.test(res.text || "");
    const blocked = (url, res) => ({ error: res.noTab ? "no cpophome tab to read from — open one, pass its check, and keep it open" : `the cpophome tab is still on its check (${res.status}) — tick the box there`, needsTab: url });

    // The drama's slug from any of its URLs: the page, its recap list, one recap
    function slugOf(url) {
        try {
            const u = new URL(url);
            if (!/(^|\.)cpophome\.com$/.test(u.hostname)) return null;
            const first = u.pathname.split("/").filter(Boolean)[0];
            return first && /^[a-z0-9-]+$/.test(first) ? first : null;
        } catch {
            return null;
        }
    }

    /**
     * The drama's slug by the site's search, on the titles given: MDL's
     * first, then the other names it is known by. Only an exact title is
     * taken — the search lists everything with a word in common, eleven
     * pages of it. Resolves to { slug, name } or { error, seen }.
     */
    async function search(fetchHtml, titles) {
        const wanted = new Set(titles.map(norm).filter(Boolean));
        const seen = [];
        // The queries: the title, then the latin "also known as" names — a
        // search in Chinese finds nothing there
        const queries = [...new Set(titles.filter((t) => /[a-z]/i.test(t)))].slice(0, 4);
        for (const [i, q] of queries.entries()) {
            if (i > 0) await pause();
            const res = await get(fetchHtml, `${CP}/?s=${encodeURIComponent(q)}`);
            if (challenged(res)) return blocked(`${CP}/?s=${encodeURIComponent(q)}`, res);
            if (limited(res)) return LIMITED;
            if (!res.ok) return { error: `cpophome ${res.status || res.error || "unreachable"}` };
            const doc = parse(res.text);
            for (const a of doc.querySelectorAll("article.category-drama h2.entry-title a[href]")) {
                const name = a.textContent.trim();
                const slug = slugOf(a.href);
                if (!slug) continue;
                if (wanted.has(norm(name))) return { slug, name };
                if (!seen.includes(name)) seen.push(name);
            }
        }
        return { error: "no drama with that title on cpophome", seen: seen.slice(0, 8) };
    }

    /** The recap numbers a drama's page lists, in order — from its ul.recap_selector. */
    function episodesListed(doc, slug) {
        const re = new RegExp(`/${slug}/recap/(\\d+)/?$`);
        const nums = new Set();
        for (const a of doc.querySelectorAll("ul.recap_selector a[href]")) {
            const m = a.getAttribute("href").match(re);
            if (m) nums.add(+m[1]);
        }
        return [...nums].sort((a, b) => a - b);
    }

    /** The show's name as the recap page heads itself: "<Name> Episode 25 Recap, Plot - CPOP HOME". */
    function showOf(doc) {
        const title = doc.querySelector("title")?.textContent ?? "";
        const m = title.match(/^(.*?)\s+Episode\s+\d+\s+Recap/i);
        if (m) return m[1].trim();
        // or the breadcrumb: the first link of the content is "> <Name>"
        const crumb = doc.querySelector("div.entry-content > a")?.textContent.replace(/^\s*>\s*/, "").trim();
        return crumb || null;
    }

    /** The recap's text: the paragraphs of the entry, and nothing else on the page. */
    function textOf(doc) {
        const entry = doc.querySelector("div.entry-content") ?? doc.querySelector("article") ?? doc.body;
        const parts = [];
        for (const p of entry.querySelectorAll(":scope > p")) {
            const t = p.textContent.replace(/\s+/g, " ").trim();
            if (t) parts.push(t);
        }
        return parts.join("\n\n");
    }

    /**
     * The recaps for one drama. `drama` is what the page knows: title, the
     * other titles (akas), episodes, offset, and the hint given by hand — a
     * URL on the site, which names the slug and skips the search. Resolves
     * to { tag, listed, recaps: [{ source, title, url, from, to, text }],
     * skipped } or { error, seen?, needsTab? }. `listed` is the range the
     * site lists, "1–19"; `skipped` says which listed recaps
     * were not read and why — "10–19: empty" for a drama still airing,
     * whose later pages are there before their text is.
     */
    async function recapsFor(fetchHtml, drama, onProgress) {
        const offset = Math.max(0, drama.episodeOffset | 0);
        const episodes = drama.episodes > 0 ? drama.episodes : null;

        let slug = drama.hint ? slugOf(drama.hint) : null;
        if (drama.hint && !slug) return { error: "the hint is not a cpophome URL — give the drama's page there" };
        let name = null;
        if (!slug) {
            const found = await search(fetchHtml, [drama.title, ...(drama.akas ?? [])]);
            if (found.error) return found;
            slug = found.slug;
            name = found.name;
        }

        // The recaps listed: on the recap index and on the drama's page, both
        // read — for a drama still airing, one of the two is a cached copy
        // from before the latest episodes (the drama's page listed 1–9 while
        // its recaps listed 1–19), so the index is asked past the cache and
        // the two lists are put together.
        const nums = new Set();
        for (const url of [`${CP}/${slug}/recap/?_=${Date.now()}`, `${CP}/${slug}/`]) {
            const page = await get(fetchHtml, url);
            if (challenged(page)) return blocked(url, page);
            if (limited(page)) return LIMITED;
            if (page.ok) for (const n of episodesListed(parse(page.text), slug)) nums.add(n);
            await pause();
        }
        const listed = [...nums].sort((a, b) => a - b);
        if (listed.length === 0) return { error: `no recaps listed on cpophome for "${name ?? slug}"`, seen: name ? [name] : undefined };
        const range = `${listed[0]}–${listed[listed.length - 1]}`;

        // Only this entry's episodes: past the part before, and no further than its count
        const wanted = listed.filter((n) => n > offset && (episodes === null || n <= offset + episodes));
        if (wanted.length === 0) return { error: `cpophome lists recaps ${range}, none past episode ${offset}` };

        const recaps = [];
        const skipped = [];
        for (const [i, n] of wanted.entries()) {
            const url = `${CP}/${slug}/recap/${n}/`;
            await pause();
            const res = await get(fetchHtml, url);
            if (challenged(res)) return blocked(url, res);
            if (limited(res)) return LIMITED;
            onProgress?.(i + 1, wanted.length);
            if (!res.ok) {
                skipped.push({ n, why: `HTTP ${res.status || res.error || "?"}` });
                continue;
            }
            const doc = parse(res.text);
            name = name ?? showOf(doc) ?? drama.title;
            const text = textOf(doc);
            if (text.length < 200) {
                skipped.push({ n, why: text.length ? "too short" : "empty" });
                continue;
            }
            recaps.push({ source: "cpophome", title: `${name}: Episode ${n}`, url, from: n - offset, to: n - offset, text });
        }
        return { tag: name ?? slug, listed: range, recaps, skipped: summarize(skipped) };
    }

    // "10–12, 15: empty · 13: HTTP 500" — the skipped recaps by reason, as ranges
    function summarize(skipped) {
        if (skipped.length === 0) return null;
        const byWhy = new Map();
        for (const s of skipped) byWhy.set(s.why, [...(byWhy.get(s.why) ?? []), s.n]);
        const ranges = (nums) => {
            const out = [];
            for (const n of nums.sort((a, b) => a - b)) {
                const last = out[out.length - 1];
                if (last && last[1] === n - 1) last[1] = n;
                else out.push([n, n]);
            }
            return out.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ");
        };
        return [...byWhy].map(([why, nums]) => `${ranges(nums)}: ${why}`).join(" · ");
    }

    return { recapsFor };
})();
